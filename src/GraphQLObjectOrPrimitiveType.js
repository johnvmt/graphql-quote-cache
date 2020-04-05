import { GraphQLScalarType } from 'graphql';
import { Kind } from 'graphql/language';

export default new GraphQLScalarType({
    name: 'ObjectOrPrimitive',
    description: 'Object or Primitive (boolean, number, string)',
    parseValue: (value) => {
        if(typeof value === 'object')
            return value;
        else if(typeof value === 'string') {
            try {
                return JSON.parse(value)
            } catch (error) {
                return value;
            }
        }
        else
            return value;

    },
    serialize: (value) => {
        if(typeof value === 'object')
            return value;
        else if(typeof value === 'string') {
            try {
                return JSON.parse(value)
            } catch (error) {
                return value;
            }
        }
        else
            return value;
    },
    parseLiteral: (ast) => {
        switch (ast.kind) {
            case Kind.OBJECT:
                throw new Error(`Not sure what to do with OBJECT for ObjectScalarType`);
            case Kind.STRING:
                try {
                    return JSON.parse(ast.value);
                }
                catch(error) {
                    return ast.value;
                }
            default:
                return ast.value;
        }
    }
});
