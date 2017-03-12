import {
  buildSchema,
} from 'graphql';

import * as fs from 'fs';
import * as path from 'path';
import * as _ from 'lodash';
import * as express from 'express';
import * as graphqlHTTP from 'express-graphql';

import { fakeSchema } from './fake_schema';

import {
  getRandomInt,
  getRandomItem,
  typeFakers,
  fakeValue,
} from './fake';

import * as opn from 'opn';

const DEFAULT_PORT = 9002;
const argv = require('yargs')
  .usage('$0 command')
  .alias('p', 'port')
  .nargs('p', 1)
  .describe('p', 'HTTP Port')
  .default('p', DEFAULT_PORT)
  .command(
    'edit [file]',
    'Open an editor and edit specified IDL file',
    yargs => {
      // wait for server to start
      setTimeout(() => {
        opn(`http://localhost:${yargs.argv.p || DEFAULT_PORT}/editor`)
      }, 0);
    }
  )
  .command(
    'start [file]',
    'Start the mocking server for specified IDL file'
  )
  .help('h')
  .alias('h', 'help')
  .argv

const fakeDefinitionIDL = fs.readFileSync(path.join(__dirname, 'fake_definition.graphql'), 'utf-8');
let userIDL;
if (argv.file) {
  userIDL = fs.readFileSync(argv.file, 'utf-8');
} else {
  userIDL = fs.readFileSync(path.join(__dirname, 'schema.graphql'), 'utf-8');
}
const idl = fakeDefinitionIDL + userIDL;

//const schema = buildSchema(idl);
//fakeSchema(schema);

import * as graphqlFetch from 'graphql-fetch';
import {
  parse,
  extendSchema,
  buildClientSchema,
  introspectionQuery,
} from 'graphql';

const swServer = graphqlFetch('http://localhost:54464') as
  (query:String, vars?:any, opts?:any) => Promise<any>;

swServer(introspectionQuery).then(introspection => {
  //TODO: check for errors
  const serverSchema = buildClientSchema(introspection.data);
  const extensionIDL = fakeDefinitionIDL + `
    extend type Person {
      pet: String @fake(type: imageUrl, options: { imageCategory: cats})
    }
  `;
  const schema = extendSchema(serverSchema, parse(extensionIDL));
  fakeSchema(schema);
  runServer(schema);
})

function runServer(schema) {
  const app = express();

  app.use('/graphql', graphqlHTTP(request => {
    return (graphqlHTTP as any).getGraphQLParams(request).then(params => {
      //Dirty hack untill graphql-express will be split into multiple middlewares:
      //https://github.com/graphql/express-graphql/issues/113
      if (params.operationName === 'null')
        params.operationName = null;
      console.log(params);
      request.body = params;

      ////if (cb)
      ////  cb(request, params.query, params.variables, params.operationName);
      //console.log('test4');
      //console.log(params);

      return {
        schema,
        graphiql: true,
      };
    });
  }));


  app.use('/editor', express.static(path.join(__dirname, 'editor')));

  app.get('/user-idl', (req, res) => {
    res
      .status(200).send(userIDL);
  })
  app.listen(argv.port);

  console.log(`http://localhost:${argv.port}:/graphql`);
}
