import DBCollection from "./DBCollection";
import SubscriptionController from "./SubscriptionController";

class LocalDBCollection extends DBCollection {

	constructor() {
		super();
		this._items = new Map();
		this._itemTTLTimeouts = new Map();
		this._subscriptions = new Map();
	}

	/* Any-type item functions */

	/**
	 *
	 * @param itemID
	 * @returns {unknown[]|any}
	 */
	getItem(itemID) {
		return this._getConvertItem(itemID);
	}

	/**
	 *
	 * @param itemID
	 * @returns {boolean}
	 */
	deleteItem(itemID) {
		this.clearItemTTL(itemID);

		if(this.hasItem(itemID)) {
			let itemWithType = this.getItemWithType(itemID);
			this._items.delete(itemID);
			this._emitItemMutation(DBCollection.ITEMMUTATIONTYPES.DELETE, itemID, itemWithType.type, itemWithType.value);
			return true;
		}
		else
			return false;
	}

	/**
	 *
	 * @param itemID
	 * @returns {SubscriptionController}
	 */
	subscribeItem(itemID) {
		const self = this;
		const itemSubscription = new SubscriptionController();

		itemSubscription.once('cancel', () => {
			self._subscriptions.get(itemID).delete(itemSubscription);

			if(self._subscriptions.get(itemID).size === 0)
				self._subscriptions.delete(itemID);
		});

		if(!self._subscriptions.has(itemID))
			self._subscriptions.set(itemID, new Set());

		self._subscriptions.get(itemID).add(itemSubscription);

		return itemSubscription;
	}

	/**
	 *
	 * @param itemID
	 * @returns {boolean}
	 */
	hasItem(itemID) {
		return this._items.has(itemID);
	}

	/**
	 *
	 * @param itemID
	 * @returns {string|GLenum|number|string}
	 */
	itemType(itemID) {
		if(!this.hasItem(itemID))
			return DBCollection.ITEMTYPES.NONE;
		else {
			const itemValue = this._items.get(itemID); // Get directly to get non-converted value
			if(Array.isArray(itemValue))
				return DBCollection.ITEMTYPES.LIST;
			else if(typeof itemValue === 'object' && itemValue !== null)
				return DBCollection.ITEMTYPES.HASH;
			else if(itemValue instanceof Set)
				return  DBCollection.ITEMTYPES.SET;
			else
				return  DBCollection.ITEMTYPES.PRIMITIVE;
		}
	}

	/**
	 *
	 * @param itemID
	 * @param itemTTL
	 * @returns {boolean}
	 */
	setItemTTL(itemID, itemTTL) {
		const self = this;

		this.clearItemTTL(itemID);

		if(this.hasItem(itemID)) {
			self._itemTTLTimeouts.set(itemID, setTimeout(() => {
				self._itemTTLTimeouts.delete(itemID);
				self.deleteItem(itemID);
			}, itemTTL * 1000));
			return true;
		}
		else
			return false;
	}

	/**
	 *
	 * @param itemID
	 * @returns {boolean}
	 */
	clearItemTTL(itemID) {
		if(this._itemTTLTimeouts.has(itemID)) {
			let itemTTLTimeout = this._itemTTLTimeouts.get(itemID);
			clearTimeout(itemTTLTimeout);
			this._itemTTLTimeouts.delete(itemID);
			return true;
		}
		else
			return false;
	}

	/* Primitive item functions */

	/**
	 *
	 * @param itemID
	 * @param itemValue
	 * @param itemTTL
	 * @returns {Promise<boolean>}
	 */
	upsertPrimitiveItem(itemID, itemValue, itemTTL = null) {
		if(!DBCollection.validPrimitiveInputValue(itemValue))
			throw new Error(DBCollection.ERRORS.INVALID_INPUT_VALUE);
		else if(!this._itemOfType(itemID, [DBCollection.ITEMTYPES.NONE, DBCollection.ITEMTYPES.PRIMITIVE]))
			throw new Error(DBCollection.ERRORS.INCOMPATIBLE_ITEM_TYPE);
		else
			return this._setItem(itemID, itemValue, itemTTL);
	}

	/**
	 *
	 * @param itemID
	 * @param increment
	 * @param itemTTL
	 * @returns {*}
	 */
	incrementPrimitiveItemBy(itemID, increment, itemTTL = null) {
		if(!this._itemOfType(itemID, [DBCollection.ITEMTYPES.NONE, DBCollection.ITEMTYPES.PRIMITIVE]))
			throw new Error(DBCollection.ERRORS.INCOMPATIBLE_ITEM_TYPE);
		else {
			let itemNumberValue = (this.hasItem(itemID)) ? this.getItem(itemID) : 0;
			const incrementedValue = DBCollection.incrementValue(itemNumberValue, increment);
			this._setItem(itemID, incrementedValue, itemTTL);
			return incrementedValue;
		}
	}

	/* Hash item functions */

	/**
	 *
	 * @param itemID
	 * @param itemValue
	 * @param itemTTL
	 * @returns {Promise<boolean>}
	 */
	upsertHashItem(itemID, itemValue, itemTTL = null) {
		if(!DBCollection.validHashInputValue(itemValue))
			throw new Error(DBCollection.ERRORS.INVALID_INPUT_VALUE);
		else if(!this._itemOfType(itemID, [DBCollection.ITEMTYPES.NONE, DBCollection.ITEMTYPES.HASH]))
			throw new Error(DBCollection.ERRORS.INCOMPATIBLE_ITEM_TYPE);
		else
			return this._setItem(itemID, itemValue, itemTTL);
	}

	/**
	 *
	 * @param itemID
	 * @param itemHashFields
	 * @param itemTTL
	 * @returns {Promise<boolean>}
	 */
	upsertHashItemFields(itemID, itemHashFields, itemTTL = null) {
		if(!DBCollection.validHashInputValue(itemHashFields))
			throw new Error(DBCollection.ERRORS.INVALID_INPUT_VALUE);
		else if(!this._itemOfType(itemID, [DBCollection.ITEMTYPES.NONE, DBCollection.ITEMTYPES.HASH]))
			throw new Error(DBCollection.ERRORS.INCOMPATIBLE_ITEM_TYPE);
		else
			return this._setItem(itemID, Object.assign({} , this.getItem(itemID), itemHashFields), itemTTL);
	}

	/**
	 *
	 * @param itemID
	 * @param fields
	 * @returns {boolean}
	 */
	deleteHashItemFields(itemID, fields) {
		if(!Array.isArray(fields))
			throw new Error(DBCollection.ERRORS.INVALID_FIELDS_LIST);
		else if(!this._itemOfType(itemID, [DBCollection.ITEMTYPES.NONE, DBCollection.ITEMTYPES.HASH]))
			throw new Error(DBCollection.ERRORS.INCOMPATIBLE_ITEM_TYPE);
		else if(!this.hasItem(itemID))
			return false;
		else { // item is HASH
			let itemValue = this.getItem(itemID);

			for(let fieldID of fields)
				delete itemValue[fieldID];

			this._setItem(itemID, itemValue);
		}
	}

	/**
	 *
	 * @param itemID
	 * @param fields
	 * @returns {Observable<{}>|undefined}
	 */
	getHashItemFields(itemID, fields) {
		if(!Array.isArray(fields))
			throw new Error(DBCollection.ERRORS.INVALID_FIELDS_LIST);
		else if(!this._itemOfType(itemID, [DBCollection.ITEMTYPES.NONE, DBCollection.ITEMTYPES.HASH]))
			throw new Error(DBCollection.ERRORS.INCOMPATIBLE_ITEM_TYPE);
		else if(!this.hasItem(itemID))
			return undefined;
		else // item is HASH
			return LocalDBCollection._filterObject(this.getItem(itemID), fields);
	}

	/**
	 *
	 * @param itemID
	 * @param fieldID
	 * @returns {SubscriptionController}
	 */
	subscribeHashItemField(itemID, fieldID) {
		const self = this;

		const itemSubscription = self.subscribeItem(itemID);

		const fieldSubscription = new SubscriptionController();

		let oldFieldValue = undefined;

		// TODO make this more efficient by not requiring two controllers
		itemSubscription.on('mutation', () => {
			if(self._itemOfType(itemID, DBCollection.ITEMTYPES.HASH)) {
				let newFieldValue = (this.hasItem(itemID)) ? (self.getItem(itemID))[fieldID] : undefined;
				if(newFieldValue !== oldFieldValue) {
					if(oldFieldValue === undefined)
						fieldSubscription.mutation(DBCollection.HASHITEMFIELDMUTATIONTYPES.INSERT, itemID, fieldID, newFieldValue);
					else if(newFieldValue === undefined)
						fieldSubscription.mutation(DBCollection.HASHITEMFIELDMUTATIONTYPES.DELETE, itemID, fieldID, newFieldValue);
					else
						fieldSubscription.mutation(DBCollection.HASHITEMFIELDMUTATIONTYPES.UPDATE, itemID, fieldID, newFieldValue);
					oldFieldValue = newFieldValue;
				}
			}
		});

		itemSubscription.once('cancel', () => {
			try {
				fieldSubscription.cancel();
			} catch (error) {}
		});

		fieldSubscription.once('cancel', () => {
			try {
				itemSubscription.cancel();
			} catch (error) {}
		});

		return fieldSubscription;
	}

	/**
	 *
	 * @param itemID
	 * @param fieldID
	 * @param increment
	 * @param itemTTL
	 * @returns {*}
	 */
	incrementHashItemFieldBy(itemID, fieldID, increment, itemTTL = null) {
		if(!this._itemOfType(itemID, [DBCollection.ITEMTYPES.NONE, DBCollection.ITEMTYPES.HASH]))
			throw new Error(DBCollection.ERRORS.INCOMPATIBLE_ITEM_TYPE);
		else {
			let itemValue = Object.assign({[fieldID]: 0}, this.getItem(itemID)); // Set field to 0, if it does not exist
			itemValue[fieldID] = DBCollection.incrementValue(itemValue[fieldID], increment);
			this._setItem(itemID, itemValue, itemTTL);
			return itemValue[fieldID];
		}
	}

	/**
	 *
	 * @param itemID
	 * @param itemValue
	 * @param itemTTL
	 * @returns {Promise<boolean>}
	 */
	upsertSetItem(itemID, itemValue, itemTTL = null) {
		if(!DBCollection.validSetInputValue(itemValue))
			throw new Error(DBCollection.ERRORS.INVALID_VALUES_LIST);
		if(!this._itemOfType(itemID, [DBCollection.ITEMTYPES.NONE, DBCollection.ITEMTYPES.SET]))
			throw new Error(DBCollection.ERRORS.INCOMPATIBLE_ITEM_TYPE);
		else {
			const itemSet = new Set(itemValue);
			return this._setItem(itemID, itemSet, itemTTL);
		}
	}

	/**
	 *
	 * @param itemID
	 * @param values
	 * @param itemTTL
	 * @returns {number|*}
	 */
	insertSetValues(itemID, values, itemTTL = null) {
		if(this._itemOfType(itemID, DBCollection.ITEMTYPES.NONE)) {
			this.upsertSetItem(itemID, values, itemTTL);
			const itemSet = this._items.get(itemID);
			return itemSet.size;
		}
		else if(this._itemOfType(itemID, DBCollection.ITEMTYPES.SET)) {
			if(!DBCollection.validSetInputValue(values))
				throw new Error(DBCollection.ERRORS.INVALID_VALUES_LIST);

			let insertedValues = [];
			const itemValue = this.getItem(itemID);

			for(let value of values) {
				if(!itemValue.has(value)) {
					itemValue.add(value);
					insertedValues.push(value);
				}
			}

			this._emitItemMutation(DBCollection.ITEMMUTATIONTYPES.INSERTVALUES, itemID, DBCollection.ITEMTYPES.SET, insertedValues);
			return insertedValues.length;
		}
		else
			throw new Error(DBCollection.ERRORS.INCOMPATIBLE_ITEM_TYPE);
	}

	/**
	 *
	 * @param itemID
	 * @param values
	 * @returns {number}
	 */
	deleteSetValues(itemID, values) {
		if(!Array.isArray(values))
			throw new Error(DBCollection.ERRORS.INVALID_VALUES_LIST);
		else if(!this._itemOfType(itemID, [DBCollection.ITEMTYPES.NONE, DBCollection.ITEMTYPES.SET]))
			throw new Error(DBCollection.ERRORS.INCOMPATIBLE_ITEM_TYPE);
		else if(!this.hasItem(itemID))
			return 0;
		else {
			let deletedValues = [];
			const itemValue = this.getItem(itemID);

			for(let value of values) {
				if(itemValue.has(value)) {
					itemValue.delete(value);
					deletedValues.push(value);
				}
			}

			this._emitItemMutation(DBCollection.ITEMMUTATIONTYPES.DELETEVALUES, itemID, DBCollection.ITEMTYPES.SET, deletedValues);
			return deletedValues.length;
		}
	}

	/**
	 *
	 * @param itemID
	 * @param typeOrTypes
	 * @returns {boolean}
	 * @private
	 */
	_itemOfType(itemID, typeOrTypes) {
		const allowedTypes = new Set((Array.isArray(typeOrTypes) ? typeOrTypes : [typeOrTypes]));
		return allowedTypes.has(this.itemType(itemID));
	}

	/**
	 *
	 * @param itemID
	 * @returns {unknown[]|undefined|any}
	 * @private
	 */
	_getConvertItem(itemID) {
		if(!this.hasItem(itemID))
			return undefined;
		else {
			const itemType = this.itemType(itemID);
			const itemValue = this._items.get(itemID);

			if(itemType === DBCollection.ITEMTYPES.SET)
				return Array.from(itemValue);
			else
				return itemValue;
		}
	}

	/**
	 *
	 * @param itemID
	 * @param itemValue
	 * @param itemTTL
	 * @returns {boolean}
	 * @private
	 */
	_setItem(itemID, itemValue, itemTTL = null) {
		const mutationType = this.hasItem(itemID) ? DBCollection.ITEMMUTATIONTYPES.UPDATE : DBCollection.ITEMMUTATIONTYPES.INSERT;
		this._items.set(itemID, itemValue);
		if(typeof itemTTL === 'number')
			this.setItemTTL(itemID, itemTTL);
		const itemType = this.itemType(itemID);
		this._emitItemMutation(mutationType, itemID, itemType, itemValue);
		return true;
	}

	/**
	 *
	 * @param mutationType
	 * @param itemID
	 * @param itemType
	 * @param itemValue
	 * @private
	 */
	_emitItemMutation(mutationType, itemID, itemType, itemValue) {
		if(this._subscriptions.has(itemID)) {
			this._subscriptions.get(itemID).forEach((controller) => {
				controller.mutation(mutationType, itemID, itemType, itemValue);
			});
		}
	}

	/**
	 *
	 * @param object
	 * @param keys
	 * @returns {*}
	 * @private
	 */
	static _filterObject(object, keys) {
		return keys.map(key => key in object ? {[key]: object[key]} : {})
			.reduce((res, o) => Object.assign(res, o), {});
	}
}

export default LocalDBCollection;
