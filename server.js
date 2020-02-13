const {
  ApolloServer,
  PubSub,
  AuthenticationError,
  UserInputError,
  ApolloError,
  SchemaDirectiveVisitor
} = require("apollo-server");
const { defaultFieldResolver, GraphQLString } = require("graphql");
const gql = require("graphql-tag");

const pubSub = new PubSub();
const NEW_ITEM = "NEW_ITEM";

class LogDirective extends SchemaDirectiveVisitor {
  visitFieldDefinition(field) {
    console.log(field);
    const resolver = field.resolve || defaultFieldResolver;
    const { message } = this.args;
    field.args.push({
      type: GraphQLString,
      name: "message"
    });
    field.resolve = (root, { message, ...rest }, ctx, info) => {
      const { message: schemaMessage } = this.args;
      console.log(" ⚡ hello", message || schemaMessage);
      return resolver.call(this, root, rest, ctx, info);
    };
  }
}

const typeDefs = gql`
  directive @log(message: String = "my message") on FIELD_DEFINITION

  type User {
    id: ID! @log(message: "id here")
    error: String! @deprecated(reason: "not sure")
    username: String!
    createdAt: String!
  }

  type Settings {
    user: User!
    theme: String!
  }

  type Item {
    task: String!
  }

  input NewSettingsInput {
    user: ID!
    theme: String!
  }

  type Query {
    me: User!
    settings(user: ID!): Settings!
  }

  type Mutation {
    settings(input: NewSettingsInput!): Settings!
    createItem(task: String!): Item!
  }

  type Subscription {
    newItem: Item
  }
`;

const items = [];
const resolvers = {
  Query: {
    me() {
      return {
        id: "1234",
        username: "coder12",
        createdAt: 3749559
      };
    },
    settings(_, { user }) {
      return {
        user,
        theme: "Light"
      };
    }
  },

  Mutation: {
    settings(_, { input }) {
      return input;
    },
    createItem(_, { task }) {
      const item = { task };
      pubSub.publish(NEW_ITEM, { newItem: item });
      return item;
    }
  },

  Subscription: {
    newItem: {
      subscribe: () => pubSub.asyncIterator(NEW_ITEM)
    }
  },

  Settings: {
    user() {
      return {
        id: "1234",
        username: "coder12",
        createdAt: 3749559
      };
    }
  },
  User: {
    error() {
      return "dsafd";
    }
  }
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
  schemaDirectives: {
    log: LogDirective
  },
  context({ connection, req }) {
    if (connection) {
      return { ...connection.context };
    }
  },
  subscriptions: {
    onConnect(params) {}
  }
});

server.listen().then(({ url }) => console.log(`server`));
