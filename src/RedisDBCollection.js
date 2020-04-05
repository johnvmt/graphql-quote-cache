import redis from "redis";
import bluebird from "bluebird";
import DBCollection from "./DBCollection";
import SubscriptionController from "./SubscriptionController";

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

class RedisDBCollection extends DBCollection {

    constructor(options = {}) {
        super();

        const self = this;

        self._clients = {
            client: redis.createClient(options.hasOwnProperty('redis') ? options.redis : {}),
            publisher: redis.createClient(options.hasOwnProperty('redis') ? options.redis : {}),
            subscriber: redis.createClient(options.hasOwnProperty('redis') ? options.redis : {})
        };

        self._subscriptions = new Map();

        self._clients.subscriber.on("message", async (channel, message) => {
            try {
                const itemID = self._itemIDFromChannel(channel);
                const mutation = message;
                if(self._subscriptions.has(itemID)) {
                    if(mutation === DBCollection.ITEMMUTATIONTYPES.DELETE)
                        self._emitItemMutation(mutation, itemID);
                    else {
                        const itemWithType = await self.getItemWithType(itemID);
                        self._emitItemMutation(mutation, itemID, itemWithType.type, itemWithType.value);
                    }
                }
            }
            catch(error) {}
        });

        self._itemChannelPrefix = 'ITEMMUTATION_';
    }

    /**
     * Get an item of any type from the collection
     * @param itemID
     * @returns {Promise<*|unknown[]>}
     */
    async getItem(itemID) {
        const itemType = await this.itemType(itemID);
        if(itemType === DBCollection.ITEMTYPES.NONE)
            return undefined;
        else if(itemType === DBCollection.ITEMTYPES.PRIMITIVE)
            return await this._clients.client.getAsync(itemID);
        else if(itemType === DBCollection.ITEMTYPES.HASH)
            return await this._clients.client.hgetallAsync(itemID);
        else if(itemType === DBCollection.ITEMTYPES.SET)
            return await this._clients.client.smembersAsync(itemID);
        // TODO list
    }

    /**
     * Delete an item of any type from the collection
     * @param itemID
     * @returns {Promise<boolean>}
     */
    async deleteItem(itemID) {
        return await this._clients.client.delAsync(itemID);

    }

    /**
     * Subscribe to mutations on an item of any type
     * Mutations can be INSERT, UPDATE, or DELETE for any item type
     * Mutations can also be INSERTVALUE or DELETEVALUE for lists and sets
     * @param itemID
     * @returns {SubscriptionController}
     */
    subscribeItem(itemID) {

        const self = this;
        const itemSubscription = new SubscriptionController();

        itemSubscription.once('cancel', async () => {
            self._subscriptions.get(itemID).delete(itemSubscription);

            if(self._subscriptions.get(itemID).size === 0) {
                self._subscriptions.delete(itemID);
                await self._clients.subscriber.unsubscribeAsync(self._itemMutationChannel(itemID));
            }

        });

        if(!self._subscriptions.has(itemID)) {
            self._subscriptions.set(itemID, new Set());

            const itemChannel = self._itemMutationChannel(itemID);
            self._clients.subscriber.subscribeAsync(itemChannel);
        }

        self._subscriptions.get(itemID).add(itemSubscription);

        return itemSubscription;
    }

    /**
     * Check if the collection has an item of any type with the specified itemID
     * @param itemID
     * @returns {Promise<boolean>}
     */
    async hasItem(itemID) {
        return await this._clients.client.existsAsync(itemID);
    }

    /**
     * Return the type of an item
     * @param itemID
     * @returns {Promise<string|number|string|"LIST"|"ListValue">}
     */
    async itemType(itemID) {
        const redisType = await this._clients.client.typeAsync(itemID);

        if(redisType === 'string')
            return DBCollection.ITEMTYPES.PRIMITIVE;
        else if(redisType === 'hash')
            return DBCollection.ITEMTYPES.HASH;
        else if(redisType === 'set')
            return DBCollection.ITEMTYPES.SET;
        else if(redisType === 'list')
            return DBCollection.ITEMTYPES.LIST;
        else if(redisType === 'none')
            return DBCollection.ITEMTYPES.NONE;
        else
            throw new Error('type_unknown')
    }

    /**
     * Set an item of any type's time to live, in seconds
     * Warning: When the item is deleted, a mutation may not be emitted
     * @param itemID
     * @param itemTTL
     * @returns {Promise<boolean>}
     */
    async setItemTTL(itemID, itemTTL) {
        return await this._clients.client.expire(itemID, itemTTL / 1000);
    }

    /**
     * Remove an item of any type's time to live
     * @param itemID
     * @returns {Promise<boolean>}
     */
    async clearItemTTL(itemID) {
        return await this._clients.client.presistsAsync(itemID);
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
        let result;
        if(itemTTL === null)
            result = await this._clients.client.setAsync(itemID, itemValue);
        else
            result = await this._clients.client.setAsync(itemID, itemValue, 'PX', itemTTL);

        this._publishMutation(itemID, DBCollection.ITEMMUTATIONTYPES.INSERT);

        return result;
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
        const result = await this._clients.client.incrbyfloatAsync(itemID, increment);

        if(itemTTL !== null)
            await this.setItemTTL(itemTTL, itemTTL);

        this._publishMutation(itemID, DBCollection.ITEMMUTATIONTYPES.INSERT);

        return result;
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
        if(!Array.isArray(fields))
            throw new Error(DBCollection.ERRORS.INVALID_FIELDS_LIST);

        const redisFieldsArray = await this._clients.client.hmgetAsync(itemID, fields);

        const hashItemFields = {};
        let index = 0;
        for(let field of fields) {
            hashItemFields[field] = redisFieldsArray[index];
            index++;
        }

        return hashItemFields;
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
        await this.deleteItem(itemID); // delete the item if it exists
        return await this.upsertHashItemFields(itemID, itemValue, itemTTL);
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
        let propertiesArray = [];
        for(let key in itemHashFields) {
            if(itemHashFields.hasOwnProperty(key))
                propertiesArray.push(key, itemHashFields[key]);
        }

        const result = await this._clients.client.hsetAsync(itemID, propertiesArray);

        if(itemTTL !== null)
            await this.setItemTTL(itemID, itemTTL);

        this._publishMutation(itemID, DBCollection.ITEMMUTATIONTYPES.INSERT);

        return result;
    }

    /**
     * Delete fields from a hash item
     * Throws an error if the item exists and is not a hash
     * @param itemID
     * @param fields
     * @returns {Promise<boolean>}
     */
    async deleteHashItemFields(itemID, fields) {
        const result = await this._clients.client.hdelAsync(itemID, fields);
        this._publishMutation(itemID, DBCollection.ITEMMUTATIONTYPES.UPDATE);
        return result;
    }

    /**
     * Subscribe to a single field in a hash-type item
     * Will not return an error, even if the item is not a hash
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
		itemSubscription.on('mutation', (mutationType, itemID, itemType, itemValue) => {
			if(mutationType === DBCollection.ITEMMUTATIONTYPES.DELETE)
                fieldSubscription.mutation(DBCollection.HASHITEMFIELDMUTATIONTYPES.DELETE, itemID, fieldID);
			if(itemType === DBCollection.ITEMTYPES.HASH) {
                let newFieldValue = (typeof itemValue === 'object' && itemValue !== null && itemValue.hasOwnProperty(fieldID)) ? itemValue[fieldID] : undefined;
                if(newFieldValue !== oldFieldValue) {
                    if(oldFieldValue === undefined)
                        fieldSubscription.mutation(DBCollection.HASHITEMFIELDMUTATIONTYPES.INSERT, itemID, fieldID, newFieldValue);
                    else if(newFieldValue === undefined)
                        fieldSubscription.mutation(DBCollection.HASHITEMFIELDMUTATIONTYPES.DELETE, itemID, fieldID);
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
     * Increment field of hash item by increment
     * If field or object does not exist, create it, with an initial field value of 0 + increment
     * @param itemID
     * @param fieldID
     * @param increment
     * @param itemTTL
     * @returns {Promise<*|unknown>}
     */
    async incrementHashItemFieldBy(itemID, fieldID, increment, itemTTL = null) {
        const result = await this._clients.client.hincrbyfloatAsync(itemID, fieldID, increment);

        if(itemTTL !== null)
            await this.setItemTTL(itemTTL, itemTTL);

        this._publishMutation(itemID, DBCollection.ITEMMUTATIONTYPES.UPDATE);

        return result;
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

    async _publishMutation(itemID, mutation) {
        this._clients.publisher.publishAsync(this._itemMutationChannel(itemID), mutation);
    }

    _itemIDFromChannel(channelName) {
        if(channelName.indexOf(this._itemChannelPrefix) === 0)
            return channelName.substr(this._itemChannelPrefix.length);
        else
            throw new Error('incorrect_channel');
    }

    _itemMutationChannel(itemID) {
        return `ITEMMUTATION_${itemID}`;
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

}

export default RedisDBCollection;
