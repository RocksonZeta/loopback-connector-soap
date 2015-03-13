'use strict';
var soap = require('soap');
var async = require('async');
var debug = require('debug')('loopback:connector:soap');
/**
 * Export the initialize method to loopback-datasource-juggler
 * @param {DataSource} dataSource The data source object
 * @param callback
 */
exports.initialize = function (dataSource , cb) {
    var settings = dataSource.settings || {}; // The settings is passed in from the dataSource
 
    var connector = new SOAPConnector(settings); // Construct the connector instance
    dataSource.connector = connector; // Attach connector to dataSource
    connector.dataSource = dataSource; // Hold a reference to dataSource
 
    /**
     * Connector instance can have an optional property named as DataAccessObject that provides
     * static and prototype methods to be mixed into the model constructor. The property can be defined
     * on the prototype.
     */
    connector.DataAccessObject = connector.DataAccessObject;

    /**
     * Connector instance can have an optional function to be called to handle data model definitions.
     * The function can be defined on the prototype too.
     * @param model The name of the model
     * @param properties An object for property definitions keyed by propery names
     * @param settings An object for the model settings
     */
    // connector.define = function(model, properties, settings) {
    
    // };
 
    // connector.connect(cb); // Run some async code for initialization
    // process.nextTick(postInit);
};

/**
 * The SOAPConnector constructor
 * @param {Object} settings The connector settings
 * @constructor
 */
function SOAPConnector(settings) {
  settings = settings || {};
  this.settings = settings;
  // var endpoint = settings.endpoint || settings.url;
  // var wsdl = settings.wsdl || (endpoint + '?wsdl');

  // this.settings = settings;
  // this.endpoint = endpoint; // The endpoint url
  // this.wsdl = wsdl; // URL or path to the url

  if (debug.enabled) {
    debug('Settings: %j', settings);
  }

  this._models = {};
  this.DataAccessObject = function() {
    // Dummy function
  };
  // var self = this;
  this.DataAccessObject.invoke =this._invoke.bind(this);
}



function setSecurity(client , opts) {
  if (opts.BasicAuth) {
    client.setSecurity(new soap.BasicAuthSecurity(opts.BasicAuth.username, opts.BasicAuth.password));
  }
  if(opts.WSSecurity) {
    client.setSecurity(new soap.WSSecurity(opts.WSSecurity.username, opts.WSSecurity.password));
  }
  if(opts.ClientSSL) {
    client.setSecurity(new soap.ClientSSLSecurity(opts.ClientSSL.keyPath, opts.ClientSSL.certPath));
  }
}

function extend() {
  var r = {};
  for(var i = 0 ;i < arguments.length ;i++) {
    if(!arguments[i]) {
      continue;
    }
    for(var k in arguments[i]) {
      r[k] = arguments[i][k];
    }
  }
  return r;
}

SOAPConnector.prototype._invoke = function(opts, cb) {
  var self = this;
  var headers = extend(this.settings.headers, opts.headers);
  var options = extend(this.settings.options, opts.options);
  soap.createClient(opts.wsdl || this.settings.wsdl ,{wsdl_headers: headers, options:options},function(e, client) {
    if (e) {
      console.error('create client failed' ,e);
      return cb(e);
    }
    setSecurity(client , opts);
    if (self.settings.soapAction || self.settings.SOAPAction) {
      client.setSOAPAction(self.settings.soapAction || self.settings.SOAPAction);
    }
    if (Array.isArray(self.settings.soapHeaders)) {
      self.settings.soapHeaders.forEach(function(header) {
        if (debug.enabled) {
          debug('adding soap header: %j', header);
        }
        if (typeof header === 'object') {
          client.addSoapHeader(client.wsdl.objectToXML(header.element, header.name,
            header.prefix, header.namespace, true));
        } else if (typeof header === 'string') {
          client.addSoapHeader(header);
        }
      });
    }
    async.map(Object.keys(opts.methods) , function(method , cb) {
      client[method](opts.methods[method], function(e, result) {
        if (e) {
          return cb(e);
        }
        cb(e, result);
      } , options,headers);
    } , function(e,r){
      if(e){
        return cb(e);
      }
      if(r &&r.length <=1 && !opts.alwaysArray) {
        return cb( null , r[0]);
      }
      return cb(null , r);
    });
  });
};



// function findKey(obj, val) {
//   for (var n in obj) {c
//     if (obj[n] === val) {
//       return n;
//     }
//   }
//   return null;
// }

// function findMethod(client, name) {
//   var portTypes = client.wsdl.definitions.portTypes;
//   for (var p in portTypes) {
//     var pt = portTypes[p];
//     for (var op in pt.methods) {
//       if (op === name) {
//         return pt.methods[op];
//       }
//     }
//   }
//   return null;
// }

// SOAPConnector.prototype.jsonToXML = function(method, json) {
//   if (!json) {
//     return '';
//   }
//   if (typeof method === 'string') {
//     var m = findMethod(this.client, method);
//     if (!m) {
//       throw new Error('Method not found in WSDL port types: ' + m);
//     } else {
//       method = m;
//     }
//   }
//   var client = this.client,
//     name = method.$name,
//     input = method.input,
//     defs = client.wsdl.definitions,
//     ns = defs.$targetNamespace,
//     message = '';

//   var alias = findKey(defs.xmlns, ns);

//   if (input.parts) {
//     message = client.wsdl.objectToRpcXML(name, json, alias, ns);
//   } else if (typeof json === 'string') {
//     message = json;
//   } else {
//     message = client.wsdl.objectToDocumentXML(input.$name, json,
//       input.targetNSAlias, input.targetNamespace, input.$type);
//   }
//   return message;
// };

// SOAPConnector.prototype.xmlToJSON = function(method, xml) {
//   if (!xml) {
//     return {};
//   }
//   if (typeof method === 'string') {
//     var m = findMethod(this.client, method);
//     if (!m) {
//       throw new Error('Method not found in WSDL port types: ' + m);
//     } else {
//       method = m;
//     }
//   }
//   var input = method.input,
//     output = method.output;

//   var json = this.client.wsdl.xmlToObject(xml);
//   var result = json.Body[output.$name] || json.Body[input.$name];
//   // RPC/literal response body may contain elements with added suffixes I.E.
//   // 'Response', or 'Output', or 'Out'
//   // This doesn't necessarily equal the output message name. See WSDL 1.1 Section 2.4.5
//   if (!result) {
//     result = json.Body[output.$name.replace(/(?:Out(?:put)?|Response)$/, '')];
//   }
//   return result;
// };

/**
 *
 * @private
 * @returns {*}
 */
// SOAPConnector.prototype.setupDataAccessObject = function() {
  // var self = this;
  // if (this.wsdlParsed && this.DataAccessObject) {
  //   return this.DataAccessObject;
  // }

  // this.wsdlParsed = true;

  // this.DataAccessObject.xmlToJSON = SOAPConnector.prototype.xmlToJSON.bind(self);
  // this.DataAccessObject.jsonToXML = SOAPConnector.prototype.jsonToXML.bind(self);

  // for (var s in this.client.wsdl.services) {
  //   var service = this.client[s];
  //   for (var p in service) {
  //     var port = service[p];
  //     for (var m in port) {
  //       var method = port[m];
  //       if (debug.enabled) {
  //         debug('Adding method: %s %s %s', s, p, m);
  //       }

  //       var methodName = this._methodName(s, p, m, this.DataAccessObject);
  //       if (debug.enabled) {
  //         debug('Method name: %s', methodName);
  //       }
  //       // var wsMethod = method.bind(this.client);
  //       var wsMethod = function() {
  //         // this.client[method]()
  //       };

  //       wsMethod.jsonToXML = SOAPConnector.prototype.jsonToXML.bind(self, findMethod(self.client, m));
  //       wsMethod.xmlToJSON = SOAPConnector.prototype.xmlToJSON.bind(self, findMethod(self.client, m));
  //       this.DataAccessObject[methodName] = wsMethod;
  //       if (this.settings.remotingEnabled) {
  //         setRemoting(wsMethod);
  //       }
  //     }
  //   }
  // }
//   this.dataSource.DataAccessObject = this.DataAccessObject;
//   for (var model in this._models) {
//     if (debug.enabled) {
//       debug('Mixing methods into : %s', model);
//     }
//     this.dataSource.mixin(this._models[model].model);
//   }
//   return this.DataAccessObject;
// };

/**
 * Hook for defining a model by the data source
 * @param {object} modelDef The model description
 */
SOAPConnector.prototype.define = function(modelDef) {
  var m = modelDef.model.modelName;
  this._models[m] = modelDef;
};

/**
 * Get types associated with the connector
 * @returns {String[]} The types for the connector
 */
SOAPConnector.prototype.getTypes = function() {
  return ['soap'];
};