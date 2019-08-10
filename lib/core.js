const fetch = require('node-fetch');
const utils = require('./utils');
const httpLayer = require('./http-layer');

module.exports = {
	config: null,

	// config = {authBaseUrl, client_id,client_secret,scope,account_id}
	init: function (config) {
		this.config = config;
		this.config.soapBaseUrl = utils.getSoapBaseUri(this.config.authBaseUrl);
	},

	getToken: async function () {
		let now = new Date();

		if (this.config.token && this.config.token.expiresOn > now) {
			return this.config.token;
		}

		let payload = {
			"grant_type": "client_credentials",
			"client_id": this.config.clientId,
			"client_secret": this.config.clientSecret,
			"scope": this.config.scope,
			"account_id": this.config.mid
		};

		return new Promise((resolve, reject) => {
			fetch(
				`${this.config.authBaseUrl}v2/token`, {
					method: 'POST',
					body: JSON.stringify(payload),
					headers: { 'Content-Type': 'application/json' },
				}
			)
				.then(res => res.json())
				.then(token => {
					if (token.expires_in) {
						token.expiresOn = new Date(now.getTime() + (token.expires_in - 30) * 1000);
					}
					token.accessToken = token.access_token;
					this.config.token = token;
					resolve(token);
				})
				.catch(error => reject(error));
		});
	},

	// options = {objectType, objects, mid?, }
	soapCreate: async function (options) {
		options.objects.forEach(function (element) {
			element['@'] = { 'xsi:type': options.objectType };
		});

		let createOptions = {
			CreateOptions: {}
		};

		let createRequest = {
			Objects: options.objects,
			Options: createOptions
		};

		let result = await this.soapExecute('Create', 'CreateRequest', createRequest);

		return result;
	},

	// options = {objectType, objects, saveAction, saveActionProperty?}
	// saveaction -> https://developer.salesforce.com/docs/atlas.en-us.noversion.mc-apis.meta/mc-apis/saveaction.htm
	soapUpdate: async function (options) {
		options.objects.forEach(function (element) {
			element['@'] = { 'xsi:type': options.objectType };
		});

		let updateRequest = {
			Options: {},
			Objects: options.objects
		};

		if (options.saveAction) {
			updateRequest.Options.SaveOptions = {
				SaveOption: {
					PropertyName: options.saveActionProperty ? options.saveActionProperty : '*',
					SaveAction: options.saveAction
				}
			}
		}

		let result = await this.soapExecute('Update', 'UpdateRequest', updateRequest);

		if (!result || !result.UpdateResponse) {
			return null;
		}

		return result.UpdateResponse;
	},

	// options = {objectType, properties, mid, allPages, filters}
	soapRetrieve: async function (options) {
		options = utils.extend({
			mid: null,
			allPages: false
		}, options);

		let result = [];
		let retrieveRequest = utils.soapCreateRetrieveRequest(options);
		let message = await this.soapExecute('Retrieve', 'RetrieveRequestMsg', retrieveRequest);
		let response = message.RetrieveResponseMsg;

		if (response.Results) {
			if (Array.isArray(response.Results)) {
				result.push.apply(result, response.Results);
			}
			else {
				result.push(response.Results);
			}
		}

		if (response.OverallStatus === 'MoreDataAvailable' && options.allPages) {
			options.continueRequest = response.RequestID;
			let recursiveResult = await this.retrieve(options);
			result.push.apply(result, recursiveResult);
		}
		else {
			if (response.OverallStatus === 'OK' || response.OverallStatus === 'MoreDataAvailable') {
				return result;
			}
			else {
				throw 'Error retrieving data: ' + (response.OverallStatus || "undefined");
			}
		}

		return result;
	},

	soapExecute: async function (actionName, requestName, requestObject) {
		let token = await this.getToken();

		let header = utils.soapGetHeader(token);

		let envelope = utils.soapGetEnvelope(requestName, requestObject, header);

		return new Promise((resolve, reject) => {
			fetch(
				`${this.config.soapBaseUrl}Service.asmx`,
				{
					method: 'POST',
					body: envelope,
					headers: {
						'Content-Type': 'text/xml',
						'SOAPAction': actionName
					},
				}
			)
				.then(res => res.text())
				.then(async res => {
					let output = await utils.soapParseReponse(res);
					resolve(output);
				})
				.catch(error => {
					reject(error)
				});
		});
	},

	restExecute: async function (options) {
		let token = await this.getToken();

		if (!options.headers) {
			options.headers = {};
		}

		options.headers["Authorization"] = "Bearer " + token.accessToken;

		return new Promise((resolve, reject) => {
			fetch(
				`${options.uri}`,
				{
					method: options.method,
					body: JSON.stringify(options.body),
					headers: options.headers
				}
			)
				.then(res => res.json())
				.then(json => {
					resolve(json);
				})
				.catch(error => {
					reject(error)
				});
		});
	}
}