import { GraphQLScalarType } from 'graphql';
import { Kind } from 'graphql/language';

export default new GraphQLScalarType({
    name: 'UnknownScalar',
    description: 'Scalar of unknown type',
    parseValue: (value) => {
        return value;
    },
    serialize: (value) => {
        return value;
    },
    parseLiteral: (ast) => {
        return ast.value;
    }
});
