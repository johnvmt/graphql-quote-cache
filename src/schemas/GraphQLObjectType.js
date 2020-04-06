import { GraphQLScalarType } from 'graphql';
import { Kind } from 'graphql/language';

export default new GraphQLScalarType({
    name: 'Object',
    description: 'Object of unknown type',
    parseValue: (value) => {
        return typeof value === 'object' ? value
            : typeof value === 'string' ? JSON.parse(value)
                : null
    },
    serialize: (value) => {
        return typeof value === 'object' ? value
            : typeof value === 'string' ? JSON.parse(value)
                : null
    },
    parseLiteral: (ast) => {
        switch (ast.kind) {
            case Kind.STRING: return JSON.parse(ast.value);
            case Kind.OBJECT: throw new Error(`Not sure what to do with OBJECT for ObjectScalarType`);
            default: return null
        }
    }
});
