class DBCollection {
	constructor() {

	}

	async upsertItem(itemID, itemValue, itemTypeOrTTLOrNull = null, itemTTLOrNull = null) {
		let itemType;
		if(typeof itemTypeOrTTLOrNull === 'string') {
			if(!Object.values(DBCollection.ITEMTYPES).contains(itemTypeOrTTLOrNull))
				throw new Error(DBCollection.ERRORS.INVALID_ITEM_TYPE);
			else
				itemType = itemTypeOrTTLOrNull;

			if(!DBCollection.validItemInputValue(itemType, itemValue))
				throw new Error(DBCollection.ERRORS.INVALID_INPUT_VALUE);
		}
		else {
			let possibleItemTypes = DBCollection.possibleItemInputTypes(itemValue);
			if(possibleItemTypes.length === 0)
				throw new Error(DBCollection.ERRORS.INVALID_INPUT_VALUE);
			else
				itemType = possibleItemTypes[0]; // NOTE: This will create a Set, when given a choice between a Set and List
		}

		let itemTTL;
		if(typeof itemTTLOrNull === 'number')
			itemTTL = itemTTLOrNull;
		else if(itemTypeOrTTLOrNull === 'number')
			itemTTL = itemTypeOrTTLOrNull;

		if(itemType === DBCollection.ITEMTYPES.PRIMITIVE)
			return await this.upsertPrimitiveItem(itemID, itemValue, itemTTL);
		else if(itemType === DBCollection.ITEMTYPES.HASH)
			return await this.upsertHashItem(itemID, itemValue, itemTTL);
		else if(itemType === DBCollection.ITEMTYPES.SET)
			return await this.upsertSetItem(itemID, itemValue, itemTTL);
		else if(itemType === DBCollection.ITEMTYPES.LIST)
			return await this.upsertListItem(itemID, itemValue, itemTTL);
	}

	/**
	 * Get an item of any type from the collection
	 * @param itemID
	 * @returns {Promise<*|unknown[]>}
	 */
	async getItem(itemID) {
		throw new Error(DBCollection.ERRORS.NOT_IMPLEMENTED);
	}

	/**
	 * Get an object with the item type and value
	 * @param itemID
	 * @returns {Promise<{type: (string|number|"LIST"|"ListValue"), value: (*|unknown[])}>}
	 */
	async getItemWithType(itemID) {
		return {
			type: await this.itemType(itemID),
			value: await this.getItem(itemID)
		}
	}

	/**
	 * Delete an item of any type from the collection
	 * @param itemID
	 * @returns {Promise<boolean>}
	 */
	async deleteItem(itemID) {
		throw new Error(DBCollection.ERRORS.NOT_IMPLEMENTED);
	}

	/**
	 * Subscribe to mutations on an item of any type
	 * Mutations can be INSERT, UPDATE, or DELETE for any item type
	 * Mutations can also be INSERTVALUE or DELETEVALUE for lists and sets
	 * @param itemID
	 * @returns {SubscriptionController}
	 */
	subscribeItem(itemID) {
		throw new Error(DBCollection.ERRORS.NOT_IMPLEMENTED);
	}

	/**
	 * Check if the collection has an item of any type with the specified itemID
	 * @param itemID
	 * @returns {Promise<boolean>}
	 */
	async hasItem(itemID) {
		throw new Error(DBCollection.ERRORS.NOT_IMPLEMENTED);
	}

	/**
	 * Return the type of an item
	 * @param itemID
	 * @returns {Promise<string|number|string|"LIST"|"ListValue">}
	 */
	async itemType(itemID) {
		throw new Error(DBCollection.ERRORS.NOT_IMPLEMENTED);
	}

	/**
	 * Set an item of any type's time to live, in seconds
	 * Warning: When the item is deleted, a mutation may not be emitted
	 * @param itemID
	 * @param itemTTL
	 * @returns {Promise<boolean>}
	 */
	async setItemTTL(itemID, itemTTL) {
		throw new Error(DBCollection.ERRORS.NOT_IMPLEMENTED);
	}

	/**
	 * Remove an item of any type's time to live
	 * @param itemID
	 * @returns {Promise<boolean>}
	 */
	async clearItemTTL(itemID) {
		throw new Error(DBCollection.ERRORS.NOT_IMPLEMENTED);
	}

	/**
	 * Insert a primitive-type item into the collection
	 * Throws an error if the item ID is already taken and of a different type
	 * Optionally, set the item's TTL
	 * @param itemID
	 * @param itemValue
	 * @param itemTTL
	 * @returns {Promise<boolean>}
	 */
	async upsertPrimitiveItem(itemID, itemValue, itemTTL = null) {
		throw new Error(DBCollection.ERRORS.NOT_IMPLEMENTED);
	}

	/**
	 * Incremenet primitive value by increment
	 * Optionally, set the item's itemTTL
	 * @param itemID
	 * @param increment
	 * @param itemTTL
	 * @returns {Promise<number>}
	 */
	async incrementPrimitiveItemBy(itemID, increment, itemTTL = null) {
		throw new Error(DBCollection.ERRORS.NOT_IMPLEMENTED);
	}

	/**
	 * Get fields from a hash item
	 * It will return an object of values, mapped by field, for the fields that do exist
	 * If the field or item does not exist, it will return undefined
	 * @param itemID
	 * @param fields
	 * @returns {Promise<undefined>}
	 */
	async getHashItemFields(itemID, fields) {
		throw new Error(DBCollection.ERRORS.NOT_IMPLEMENTED);
	}

	/**
	 * Convenience method to get a single field from a hash item
	 * @param itemID
	 * @param fieldID
	 * @returns {Promise<undefined>}
	 */
	async getHashItemField(itemID, fieldID) {
		const itemFields = await this.getHashItemFields(itemID, [fieldID]);
		return (typeof itemFields === 'object' && itemFields !== null && itemFields.hasOwnProperty(fieldID)) ? itemFields[fieldID] : undefined;
	}

	/**
	 * Insert a hash-type item into the collection
	 * Throws an error if the item ID is already taken and of a different type
	 * Optionally, set the item's TTL
	 * @param itemID
	 * @param itemValue
	 * @param itemTTL
	 * @returns {Promise<boolean>}
	 */
	async upsertHashItem(itemID, itemValue, itemTTL = null) {
		throw new Error(DBCollection.ERRORS.NOT_IMPLEMENTED);
	}

	/**
	 * If the item exists and is a hash, override or insert new fields
	 * Otherwise, insert a new hash-type item into the collection (equivalent to upsertHashItem)
	 * Throws an error if the item ID is already taken and of a different type
	 * Optionally, set the item's TTL
	 * @param itemID
	 * @param itemHashFields
	 * @param itemTTL
	 * @returns {Promise<boolean>}
	 */
	async upsertHashItemFields(itemID, itemHashFields, itemTTL = null) {
		throw new Error(DBCollection.ERRORS.NOT_IMPLEMENTED);
	}

	/**
	 * Delete fields from a hash item
	 * Throws an error if the item exists and is not a hash
	 * @param itemID
	 * @param fields
	 * @returns {Promise<boolean>}
	 */
	async deleteHashItemFields(itemID, fields) {
		throw new Error(DBCollection.ERRORS.NOT_IMPLEMENTED);
	}

	/**
	 * Subscribe to a single field in a hash-type item
	 * Will not return an error, even if the item is not a hash
	 * @param itemID
	 * @param fieldID
	 * @returns {SubscriptionController}
	 */
	subscribeHashItemField(itemID, fieldID) {
		throw new Error(DBCollection.ERRORS.NOT_IMPLEMENTED);
	}

	/**
	 * Increment field of hash item by increment
	 * If field or object does not exist, create it, with an initial field value of 0 + increment
	 * @param itemID
	 * @param fieldID
	 * @param increment
	 * @param itemTTL
	 * @returns {Promise<*|unknown>}
	 */
	async incrementHashItemFieldBy(itemID, fieldID, increment, itemTTL = null) {
		throw new Error(DBCollection.ERRORS.NOT_IMPLEMENTED)
	}

	/**
	 * Insert a new set, or override an existing set
	 * @param itemID
	 * @param itemValue
	 * @param itemTTL
	 * @returns {Promise<boolean>}
	 */
	async upsertSetItem(itemID, itemValue, itemTTL = null) {
		throw new Error(DBCollection.ERRORS.NOT_IMPLEMENTED);
	}

	/**
	 * Add values into a set-type item
	 * Duplicate values will not be added
	 * Throws an error if the item exists and is not a set
	 * Optionally, set the item's TTL
	 * @param itemID
	 * @param values
	 * @param itemTTL
	 * @returns {Promise<number>}
	 */
	async insertSetValues(itemID, values, itemTTL = null) {
		throw new Error(DBCollection.ERRORS.NOT_IMPLEMENTED);
	}

	/**
	 * Delete values from a set-type item
	 * Throws an error if the item exists and is not a set
	 * @param itemID
	 * @param values
	 * @returns {Promise<number>}
	 */
	async deleteSetValues(itemID, values) {
		throw new Error(DBCollection.ERRORS.NOT_IMPLEMENTED);
	}

	async upsertListItem(itemID, itemValue, itemTTL = null) {
		throw new Error(DBCollection.ERRORS.NOT_IMPLEMENTED);
	}

	static get ITEMMUTATIONTYPES() {
		return Object.freeze({
			INSERT: 'INSERT',
			UPDATE: 'UPDATE',
			DELETE: 'DELETE',
			INSERTVALUES: 'INSERTVALUES',
			DELETEVALUES: 'DELETEVALUES'
		});
	}

	static get HASHITEMFIELDMUTATIONTYPES() {
		return Object.freeze({
			INSERT: 'INSERT',
			UPDATE: 'UPDATE',
			DELETE: 'DELETE'
		});
	}

	static get ITEMTYPES() {
		return Object.freeze({
			HASH: 'HASH',
			SET: 'SET',
			LIST: 'LIST',
			PRIMITIVE: 'PRIMITIVE',
			NONE: 'NONE'
		});
	}

	static get ERRORS() {
		return Object.freeze({
			NOT_IMPLEMENTED: 'Not implemented',
			INVALID_INPUT_VALUE: 'Invalid input value',
			INVALID_ITEM_TYPE: 'Invalid item type',
			UNKNOWN_ITEM_TYPE: 'Internal error: Unknown item type',
			INCOMPATIBLE_ITEM_TYPE: 'Incompatible item type',
			INVALID_FIELDS_LIST: 'Invalid field list',
			INVALID_VALUES_LIST: 'Invalid values list'
		});
	}

	/**
	 * Test if itemValue is a valid itemType
	 * @param itemType
	 * @param testValue
	 * @returns {arg is Array<any>|boolean}
	 */
	static validItemInputValue(itemType, testValue) {
		if(itemType === DBCollection.ITEMTYPES.PRIMITIVE)
			return DBCollection.validPrimitiveInputValue(testValue);
		else if(itemType === DBCollection.ITEMTYPES.HASH)
			return DBCollection.validHashInputValue(testValue);
		else if(itemType === DBCollection.ITEMTYPES.SET)
			return DBCollection.validSetInputValue(testValue);
		else if(itemType === DBCollection.ITEMTYPES.LIST)
			return DBCollection.validListInputValue(testValue);
		else
			throw new Error(DBCollection.ERRORS.INVALID_ITEM_TYPE);
	}

	/**
	 * Test which type/s of Item might have the testValue
	 * @param testValue
	 * @param testItemTypes
	 * @returns {[]}
	 */
	static possibleItemInputTypes(testValue, testItemTypes) {
		if(!Array.isArray(testItemTypes))
			testItemTypes = Object.values(DBCollection.ITEMTYPES).filter((itemType) => {
				return itemType !== DBCollection.ITEMTYPES.NONE
			});

		let validItemTypes = [];
		for(let itemType of testItemTypes) {
			if(!DBCollection.ITEMTYPES.hasOwnProperty(itemType))
				throw new Error(DBCollection.ERRORS.INVALID_ITEM_TYPE);
			else if(DBCollection.validItemInputValue(itemType, testValue))
				validItemTypes.push(itemType);
		}
		return validItemTypes;
	}

	/**
	 * Returns true if testValue is a valid none (undefined)
	 * @param testValue
	 * @returns {boolean}
	 */
	static validNoneInputValue(testValue) {
		return testValue === undefined;
	}

	/**
	 * Returns true if testValue is a valid primitive (null, boolean, number, string)
	 * @param testValue
	 * @returns {boolean}
	 */
	static validPrimitiveInputValue(testValue) {
		// TODO accept object types, which can be cast back to strings
		return (testValue === null || typeof testValue === 'boolean' || typeof testValue === 'number' || typeof testValue === 'string')
	}

	/**
	 * Returns true if testValue is a valid hash item type (non-null object)
	 * @param testValue
	 * @returns {boolean}
	 */
	static validHashInputValue(testValue) {
		return (typeof testValue === 'object' && testValue !== null);
	}

	/**
	 * Returns true if testValue is an array
	 * NOTE: does NOT check if array contains duplicate values
	 * @param testValue
	 * @returns {arg is Array<any>}
	 */
	static validSetInputValue(testValue) {
		return Array.isArray(testValue);
	}

	/**
	 * Returns true if testValue is an array
	 * @param testValue
	 * @returns {arg is Array<any>}
	 */
	static validListInputValue(testValue) {
		return Array.isArray(testValue);
	}

	static incrementValue(value, increment) {
		return Number(value) + Number(increment);
	}
}

export default DBCollection
