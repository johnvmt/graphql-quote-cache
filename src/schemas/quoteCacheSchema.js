import { makeExecutableSchema } from 'graphql-tools';
import gql from 'graphql-tag';
import EventEmitterAsyncIterator from 'event-emitter-async-iterator';
import GraphQLObjectType from "./GraphQLObjectType";
import GraphQLObjectOrPrimitiveType from "./GraphQLObjectOrPrimitiveType";
import GraphQLUnknownScalarType from "./GraphQLUnknownScalarType";
import { DBCollection } from "quote-cache";

export default (collections, defaultCollectionID) => {

	const typeDefs = gql`
		scalar ObjectOrPrimitive
		
		scalar Object
		
		scalar UnknownScalar
		
		enum ItemMutationType {
			GET
			${Object.values(DBCollection.ITEMMUTATIONTYPES).join('\n')}
		}
		
		enum HashItemFieldMutationType {
			GET
			${Object.values(DBCollection.HASHITEMFIELDMUTATIONTYPES).join('\n')}
		}
		
		enum ItemType {
			${Object.values(DBCollection.ITEMTYPES).join('\n')}
		}
		
		type Item {
			itemID: ID!
			itemType: ItemType!
			itemValue: ObjectOrPrimitive
		}
		
		type ItemMutation {
			mutationType: ItemMutationType!
			item: Item!
		}
	
		input BulkSetItemInput {
			collectionID: ID!
			itemID: ID!
			itemType: ItemType
			itemValue: ObjectOrPrimitive!
			itemTTL: Float
		}
		
		input BulkDeleteItemInput {
			collectionID: ID!
			itemID: ID!
		}
		
		input BulkDeleteHashItemFieldInput {
			collectionID: ID!
			itemID: ID!
			fieldID: String!
		}
		
		type HashItemField {
			itemID: ID!
			fieldID: String!
			fieldValue: UnknownScalar
		}
		
		type HashItemFieldMutation {
			mutationType: HashItemFieldMutationType!
			field: HashItemField!
		}
		
		input BulkSetHashItemFieldInput {
			collectionID: ID
			itemID: ID!
			itemType: ItemType
			fieldID: String!
			fieldValue: UnknownScalar!
			itemTTL: Float
		}
	
		type Query {
			getItem(
				collectionID: ID
				itemID: ID!
			): Item!
			getHashItemField(
				collectionID: ID
				itemID: ID!
				fieldID: String!
			): HashItemField!
		}
	
		type Mutation {
			setItem(
				collectionID: ID
				itemID: ID!
				itemType: ItemType
				itemValue: ObjectOrPrimitive!
				itemTTL: Float
			): Boolean
			bulkSetItem(
				bulk: [BulkSetItemInput]!
			): Boolean
			incrementPrimitiveItem(
				collectionID: ID
				itemID: ID!
				itemTTL: Float
				increment: Float
			): UnknownScalar!
			setHashItemField(
				collectionID: ID
				itemID: ID!
				fieldID: String!
				fieldValue: UnknownScalar!
				itemTTL: Float
			): Boolean
			bulkSetHashItemField(
				bulk: [BulkSetHashItemFieldInput]!
			): Boolean
			incrementHashItemField(
				collectionID: ID
				itemID: ID!
				itemTTL: Float
				fieldID: String!
				increment: Float
			): UnknownScalar!
			deleteItem(
				collectionID: ID
				itemID: ID!
			): Boolean
			bulkDeleteItem(
				bulk: [BulkDeleteItemInput]!
			): Boolean
			deleteHashItemField(
				collection: String
				item: ID!
				field: String!
			): Boolean
			bulkDeleteHashItemField(
				bulk: [BulkDeleteHashItemFieldInput]!
			): Boolean
		}
		
		type Subscription {
			item(
				collectionID: ID
				itemID: ID!
			): ItemMutation
			hashItemField(
				collectionID: ID
				itemID: ID!
				fieldID: String!
			): HashItemFieldMutation
		}
	`;

	const resolvers = {
		ObjectOrPrimitive: GraphQLObjectOrPrimitiveType,

		Object: GraphQLObjectType,

		UnknownScalar: GraphQLUnknownScalarType,

		Query: {
			getItem: async (root, args, context) => {
				const sanitizedArgs = sanitizeSetItemInput(args);
				const collection = collections.get(sanitizedArgs.collectionID);

				const itemWithType = await collection.getItemWithType(sanitizedArgs.itemID);

				return {
					itemID: sanitizedArgs.itemID,
					itemType: itemWithType.type,
					itemValue: itemWithType.value
				}
			},
			getHashItemField: async (root, args, context) => {
				const sanitizedArgs = sanitizeSetItemInput(args);
				const collection = collections.get(sanitizedArgs.collectionID);

				return {
					itemID: sanitizedArgs.itemID,
					fieldID: sanitizedArgs.fieldID,
					fieldValue: await collection.getHashItemField(sanitizedArgs.itemID, sanitizedArgs.fieldID)
				}
			}
		},
		Mutation: {
			setItem: async (root, args, context) => {
				const sanitizedArgs = sanitizeSetItemInput(args);
				const collection = collections.get(sanitizedArgs.collectionID);
				if(sanitizedArgs.hasOwnProperty('inputType'))
					return await collection.upsertItem(sanitizedArgs.itemID, sanitizedArgs.itemValue, sanitizedArgs.inputType, sanitizedArgs.itemTTL);
				else
					return await collection.upsertItem(sanitizedArgs.itemID, sanitizedArgs.itemValue, sanitizedArgs.itemTTL);
			},
			bulkSetItem: async (root, args, context) => {
				// TODO check for duplicates
				const errors = [];

				for(let bulkArg of args.bulk) {
					try {
						const sanitizedArgs = sanitizeSetItemInput(args);
						const collection = collections.get(sanitizedArgs.collectionID);
						if(sanitizedArgs.hasOwnProperty('inputType'))
							return await collection.upsertItem(sanitizedArgs.itemID, sanitizedArgs.itemValue, sanitizedArgs.inputType, sanitizedArgs.itemTTL);
						else
							return await collection.upsertItem(sanitizedArgs.itemID, sanitizedArgs.itemValue, sanitizedArgs.itemTTL);
					}
					catch(error) {
						errors.push(error);
					}
				}

				if(errors.length)
					throw new Error(JSON.stringify(errors));

				return true;
			},
			incrementPrimitiveItem: async (root, args, context) => {
				const sanitizedArgs = sanitizeSetItemInput(args);
				const increment = sanitizedArgs.hasOwnProperty('increment') ? sanitizedArgs.increment : 1;
				return await collections.get(sanitizedArgs.collectionID).incrementPrimitiveItemBy(sanitizedArgs.itemID, increment, sanitizedArgs.itemTTL);
			},
			setHashItemField: async (root, args, context) => {
				const sanitizedArgs = sanitizeSetItemInput(args);
				const hashFields = {
					[sanitizedArgs.fieldID]: sanitizedArgs.fieldValue
				};

				await collections.get(sanitizedArgs.collectionID).upsertHashItemFields(sanitizedArgs.itemID, hashFields, sanitizedArgs.itemTTL);
				return true;
			},
			bulkSetHashItemField: async (root, args, context) => {
				const errors = [];

				try {
					const setCollectionsItems = new Map();
					for(let bulkArg of args.bulk) {
						const sanitizedArgs = sanitizeSetItemInput(bulkArg);

						if(!setCollectionsItems.has(sanitizedArgs.collectionID))
							setCollectionsItems.set(sanitizedArgs.collectionID, new Map());

						if(!setCollectionsItems.get(sanitizedArgs.collectionID).has(sanitizedArgs.itemID))
							setCollectionsItems.get(sanitizedArgs.collectionID).set(sanitizedArgs.itemID, {
									hashFields: {},
									itemTTL: null
								}
							);

						let itemSetMeta = setCollectionsItems.get(sanitizedArgs.collectionID).get(sanitizedArgs.itemID);

						if(itemSetMeta.itemTTL !== null && sanitizedArgs.itemTTL !== itemSetMeta.itemTTL)
							throw new Error(`Conflicting itemTTL on collectionID "${sanitizedArgs.collectionID}" and itemID "${sanitizedArgs.itemID}"`);
						else if(itemSetMeta.hashFields.hasOwnProperty(sanitizedArgs.fieldID) && itemSetMeta.hashFields[sanitizedArgs.fieldID] !== sanitizedArgs.fieldValue)
							throw new Error(`Conflicting value on collectionID "${sanitizedArgs.collectionID}" itemID "${sanitizedArgs.itemID}" fieldID "${sanitizedArgs.fieldID}"`);
						else {
							itemSetMeta.hashFields[sanitizedArgs.fieldID] = sanitizedArgs.fieldValue;
							itemSetMeta.itemTTL = sanitizedArgs.itemTTL;
						}
					}

					for(let setCollectionItemsKeyVal of setCollectionsItems) {
						const collectionID = setCollectionItemsKeyVal[0];
						const setCollectionItems = setCollectionItemsKeyVal[1];

						for(let setCollectionItemKeyVal of setCollectionItems) {
							const itemID = setCollectionItemsKeyVal[0];
							const hashFields = setCollectionItemsKeyVal[1].hashFields;
							const itemTTL = setCollectionItemsKeyVal[1].itemTTL;
							await collections.get(collectionID).upsertHashItemFields(itemID, hashFields, itemTTL);
						}
					}
				}
				catch(error) {
					errors.push(error);
				}

				if(errors.length)
					throw new Error(JSON.stringify(errors));

				return true;
			},
			incrementHashItemField: async (root, args, context) => {
				const sanitizedArgs = sanitizeSetItemInput(args);
				const increment = sanitizedArgs.hasOwnProperty('increment') ? sanitizedArgs.increment : 1;
				return await collections.get(sanitizedArgs.collectionID).incrementHashItemFieldBy(sanitizedArgs.itemID, sanitizedArgs.fieldID, increment, sanitizedArgs.itemTTL);
			},
			deleteItem: async (root, args, context) => {
				const sanitizedArgs = sanitizeSetItemInput(args);
				return await collections.get(sanitizedArgs.collectionID).deleteItem(sanitizedArgs.itemID);
			},
			bulkDeleteItem: async (root, args, context) => {
				// TODO check for duplicates
				const errors = [];

				for(let bulkArg of args.bulk) {
					try {
						const sanitizedArgs = sanitizeSetItemInput(bulkArg);
						await collections.get(sanitizedArgs.collectionID).deleteItem(sanitizedArgs.item);
					}
					catch(error) {
						errors.push(error);
					}
				}

				if(errors.length)
					throw new Error(JSON.stringify(errors));

				return true;
			},
			deleteHashItemField: async (root, args, context) => {
				const sanitizedArgs = sanitizeSetItemInput(args);
				return await collections.get(sanitizedArgs.collectionID).deleteHashItemFields(sanitizedArgs.itemID, [sanitizedArgs.fieldID]);
			},
			bulkDeleteHashItemField: async (root, args, context) => {
				const errors = [];

				try {
					const deleteCollectionsItemsFields = new Map();
					for(let bulkArg of args.bulk) {
						const sanitizedArgs = sanitizeSetItemInput(bulkArg);

						if(!deleteCollectionsItemsFields.has(sanitizedArgs.collectionID))
							deleteCollectionsItemsFields.set(sanitizedArgs.collectionID, new Map());

						if(!deleteCollectionsItemsFields.get(sanitizedArgs.collectionID).has(sanitizedArgs.itemID))
							deleteCollectionsItemsFields.get(sanitizedArgs.collectionID).set(sanitizedArgs.itemID, []);

						let fields = deleteCollectionsItemsFields.get(sanitizedArgs.collectionID).get(sanitizedArgs.itemID);

						fields.push(sanitizedArgs.fieldID);
					}

					for(let setCollectionItemsKeyVal of deleteCollectionsItemsFields) {
						const collectionID = setCollectionItemsKeyVal[0];
						const setCollectionItems = setCollectionItemsKeyVal[1];

						for(let setCollectionItemKeyVal of setCollectionItems) {
							const itemID = setCollectionItemsKeyVal[0];
							const fields = setCollectionItemsKeyVal[1];
							await collections.get(collectionID).deleteHashItemFields(itemID, fields);
						}
					}
				}
				catch(error) {
					errors.push(error);
				}

				if(errors.length)
					throw new Error(JSON.stringify(errors));

				return true;
			}
		},
		Subscription: {
			item: {
				subscribe: (obj, args, context, info) => {
					const sanitizedArgs = sanitizeSetItemInput(args);
					const itemSubscription = collections.get(sanitizedArgs.collectionID).subscribeItem(sanitizedArgs.itemID);
					const asyncIterator = new EventEmitterAsyncIterator();

					itemSubscription.on('mutation', (mutationType, itemID, itemType, itemValue) => {

						// TODO filter by mutation type
						asyncIterator.pushValue({
							item: {
								mutationType: mutationType,
								item: {
									itemID: itemID,
									itemType: itemType,
									itemValue: itemValue
								}
							}
						});
					});

					asyncIterator.once('return', () => {
						itemSubscription.cancel();
					});

					return asyncIterator;
				}
			},
			hashItemField: {
				subscribe: (obj, args, context, info) => {
					const sanitizedArgs = sanitizeSetItemInput(args);
					const itemFieldSubscription = collections.get(sanitizedArgs.collectionID).subscribeHashItemField(sanitizedArgs.itemID, sanitizedArgs.fieldID);
					const asyncIterator = new EventEmitterAsyncIterator();

					itemFieldSubscription.on('mutation', (mutationType, itemID, fieldID, fieldValue) => {
						// TODO filter by mutation type
						asyncIterator.pushValue({
							hashItemField: {
								mutationType: mutationType,
								field: {
									itemID: itemID,
									fieldID: fieldID,
									fieldValue: fieldValue
								}
							}
						});
					});

					asyncIterator.once('return', () => {
						itemFieldSubscription.cancel();
					});

					collections.get(sanitizedArgs.collectionID).getHashItemField(sanitizedArgs.itemID, sanitizedArgs.fieldID)
						.then(fieldValue => {
							asyncIterator.pushValue({
								hashItemField: {
									mutationType: 'GET',
									field: {
										itemID: sanitizedArgs.itemID,
										fieldID: sanitizedArgs.fieldID,
										fieldValue: fieldValue
									}
								}
							});
						});

					return asyncIterator;
				}
			}
		}
	};

	function sanitizeSetItemInput(inputs) {
		const sanitizedArgs = Object.assign({}, {collectionID: defaultCollectionID}, inputs);

		if(!sanitizedArgs.hasOwnProperty('collectionID'))
			throw new Error(`"collectionID" undefined in "${JSON.stringify(inputs)}"`);
		else if(!collections.has(sanitizedArgs.collectionID))
			throw new Error(`Collection "${sanitizedArgs.collectionID}" not found`);

		return sanitizedArgs;
	}

	return makeExecutableSchema({
		typeDefs,
		resolvers
	});
}
