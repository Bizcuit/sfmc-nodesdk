var utils       = require('./utils');
var httpLayer   = require('./http-layer');

module.exports = {
	config:		null,

	// config = {login, password, stack} or {clientID, clientSecret, stack}
	init: function(config){
		this.config = config;
	},

	/* ---------------------------------------------- */
	/* ------------------ SOAP API ------------------ */
	/* ---------------------------------------------- */

	buildFilter: function(filter){
		if(!filter.logicalOperator){
			filter['@'] = {'xsi:type': 'SimpleFilterPart'};
			return filter;
		}

		var result = {
			'@': {'xsi:type': 'ComplexFilterPart'}
		};

		result.LeftOperand = this.buildFilter(filter.leftOperand);
		result.RightOperand = this.buildFilter(filter.rightOperand);
		result.LogicalOperator = filter.logicalOperator;
		
		return result;
	},

	createRetrieveRequest: function(options){

		var RetrieveRequestMsg = {
			RetrieveRequest:{
				ObjectType: options.objectType,
				Properties: options.properties
			}
		};

		if(options.mid){
			if(options.mid === 'all'){
				RetrieveRequestMsg.RetrieveRequest.QueryAllAccounts = true;
			}
			else{
				RetrieveRequestMsg.RetrieveRequest.ClientIDs = {
					ID: options.mid
				};
			}
		}

		if(options.continueRequest){
			RetrieveRequestMsg.RetrieveRequest.ContinueRequest = options.continueRequest;
		}

		if(options.filter){
			RetrieveRequestMsg.RetrieveRequest.Filter = this.buildFilter(options.filter);
		}

		return RetrieveRequestMsg;
	},

	// options = {objectType, objects, mid?, }
	create: async function(options){
		options.objects.forEach(function(element) {
			element['@'] = {'xsi:type': options.objectType};

			if(options.mid){
				element.Client = {
					ID: options.mid
				}
			}
		});

		var createOptions = {
			CreateOptions: {}
		};

		if(options.mid){
			createOptions.CreateOptions.Client = {
				ID: options.mid
			}
		}

		var createRequest = {
			Objects: options.objects,
			Options: createOptions
		};
		
		var result = await this.execute('Create', 'CreateRequest', createRequest);

		return result;
	},

	// options = {objectType, objects, saveAction, saveActionProperty?}
	// saveaction -> https://developer.salesforce.com/docs/atlas.en-us.noversion.mc-apis.meta/mc-apis/saveaction.htm
	update: async function(options){
		options.objects.forEach(function(element) {
			element['@'] = {'xsi:type': options.objectType};
		});

		var updateRequest = {
			Options: {},
			Objects: options.objects
		};

		if(options.saveAction){
			updateRequest.Options.SaveOptions = {
				SaveOption: {
					PropertyName:   options.saveActionProperty ? options.saveActionProperty : '*',
					SaveAction:     options.saveAction
				}
			}
		}

		var result = await this.execute('Update', 'UpdateRequest', updateRequest);
		
		if(!result || !result.UpdateResponse){
			return null;
		}

		return result.UpdateResponse;
	},

	// options = {objectType, properties, mid, pages, filters}
	retrieve: async function(options){
		var result           = [];
		var options          = utils.extend({
			mid:    'all',
			pages:  'all'
		}, options);

		var retrieveRequest  = this.createRetrieveRequest(options);
		var message          = await this.execute('Retrieve', 'RetrieveRequestMsg', retrieveRequest);
		var response         = message.RetrieveResponseMsg;

		if(response.Results){
			if(Array.isArray(response.Results)){
				result.push.apply(result, response.Results);
			}
			else {
				result.push(response.Results);
			}
		}
		
		if(response.OverallStatus === 'MoreDataAvailable' && options.pages === 'all'){
			options.continueRequest   = response.RequestID;
			var recursiveResult       = await this.retrieve(options);
			result.push.apply(result, recursiveResult);
		}
		else{
			if(response.OverallStatus === 'OK' || response.OverallStatus === 'MoreDataAvailable'){
				return result;
			}
			else {
				throw 'Error retrieving data: ' + (response.OverallStatus || "undefined");
			}
		}

		return result;
	},

	execute: async function(actionName, requestName, requestObject){
		if(!this.config.soapHeader){
			this.config.soapHeader = await this._prepareSoapApiHeader();
		}

		var response = await httpLayer.executeSoapCall(
			actionName, 
			requestName, 
			requestObject, 
			this.config
		);

		return response;
	},






	/* ---------------------------------------------- */
	/* ------------------ REST API ------------------ */
	/* ---------------------------------------------- */

	executeRest: async function(options){
		if(!this.config.token){
			this.config.token = await this.getToken(this.config.clientID, this.config.clientSecret);
		}

		if(!options.headers){
			options.headers = {};
		}

		options.headers["Authorization"] = "Bearer " + this.config.token.accessToken;

		var response = await httpLayer.executeHttpCall(
			options.uri, 
			options.method,
			options.body,
			options.headers
		);

		return JSON.parse(response);

	},

	getToken: async function(clientID, clientSecret){
		var response = await httpLayer.executeHttpCall(
			"https://auth.exacttargetapis.com/v1/requestToken", 
			"POST",
			JSON.stringify({
				"clientId":      clientID,
				"clientSecret":  clientSecret
			}),
			{
				"Content-Type": "application/json"
			}
		);

		return JSON.parse(response);
	},

	_prepareSoapApiHeader: async function(){
		var header = {};
		
		// Login password auth
		if(this.config.login){
			header.Security = {
				'@':{
					"xmlns": "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd"
				},
				UsernameToken: {
					"Username": this.config.login,
					"Password": this.config.password					
				}
			}

			return header;
		}
		
		// Fuel token auth
		if(this.config.clientID || this.config.token){
			if(!this.config.token){
				this.config.token = await this.getToken(this.config.clientID, this.config.clientSecret);
			}
			
			header.fueloauth = {
				"@": {
					xmlns: "http://exacttarget.com"
				},
				"_": this.config.token.accessToken
			}

			return header;
		}

		throw "No authorization information was provided";
	}
}