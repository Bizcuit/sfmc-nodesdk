const xml2js = require('xml2js');

module.exports = {
	soapCreateRetrieveRequest: function (options) {
		let RetrieveRequestMsg = {
			RetrieveRequest: {
				ObjectType: options.objectType,
				Properties: options.properties
			}
		};

		if (options.mid) {
			RetrieveRequestMsg.RetrieveRequest.ClientIDs = { ID: options.mid };
		}
		else {
			RetrieveRequestMsg.RetrieveRequest.QueryAllAccounts = true;
		}

		if (options.continueRequest) {
			RetrieveRequestMsg.RetrieveRequest.ContinueRequest = options.continueRequest;
		}

		if (options.filter) {
			RetrieveRequestMsg.RetrieveRequest.Filter = this.buildFilter(options.filter);
		}

		return RetrieveRequestMsg;
	},

	soapGetEnvelope: function (requestName, request, header) {
		let envelopeTemplate = {
			"@": {
				"xmlns:soapenv": "http://schemas.xmlsoap.org/soap/envelope/",
				"xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance"
			},
			"soapenv:Header": {
				"Security": {
					"@": {
						"xmlns": "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd"
					}
				}
			},
			"soapenv:Body": {}
		};

		let builder = new xml2js.Builder({
			headless: true,
			explicitRoot: false,
			attrkey: '@',
			rootName: "soapenv:Envelope"
		});

		envelopeTemplate["soapenv:Header"] = header;
		envelopeTemplate["soapenv:Body"] = {};
		envelopeTemplate["soapenv:Body"][requestName] = request;
		envelopeTemplate["soapenv:Body"][requestName]["@"] = { xmlns: 'http://exacttarget.com/wsdl/partnerAPI' };

		return builder.buildObject(envelopeTemplate);
	},

	soapGetHeader: function (token) {
		return {
			fueloauth: {
				"@": {
					xmlns: "http://exacttarget.com"
				},
				"_": token.accessToken
			}
		};
	},

	soapParseReponse: async function (response) {
		return new Promise((resolve, reject) => {
			xml2js.parseString(response, { ignoreAttrs: true, explicitArray: false }, function (err, outputObject) {
				if (err) {
					reject("Error parsing soap response:" + JSON.stringify(err) + response);
				}
				else {

					if (outputObject && outputObject['soap:Envelope'] && outputObject['soap:Envelope']['soap:Body']) {
						let body = outputObject['soap:Envelope']['soap:Body'];
						let properties = Object.keys(body);

						if (body["soap:Fault"]) {
							reject(body["soap:Fault"].faultstring);
							return;
						}

						if (properties.length > 0 && properties[0].toLowerCase().indexOf("response") > 0 && body[properties[0]].OverallStatus == "Error") {

							reject("OverallStatus - Error: " + JSON.stringify(body));
						}

						resolve(body);
					}
					else {
						reject("soap:Body not found in the resonse: " + response);
					}
				}
			});
		});
	},

	getSoapBaseUri: function (authBaseUri) {
		let match = authBaseUri.match(/https\:\/\/(?<domain>[^\.]+)\./i);

		if (match && match.groups && match.groups.domain) {
			return `https://${match.groups.domain}.soap.marketingcloudapis.com/`;
		}

		return null;
	},

	buildFilter: function (filter) {
		if (!filter.logicalOperator) {
			filter['@'] = { 'xsi:type': 'SimpleFilterPart' };
			return filter;
		}

		let result = {
			'@': { 'xsi:type': 'ComplexFilterPart' }
		};

		result.LeftOperand = this.buildFilter(filter.leftOperand);
		result.RightOperand = this.buildFilter(filter.rightOperand);
		result.LogicalOperator = filter.logicalOperator;

		return result;
	},

	extend: function (origin, add) {
		// Don't do anything if add isn't an object
		if (!add || typeof add !== 'object') return origin;

		let keys = Object.keys(add);
		let i = keys.length;

		while (i--) {
			origin[keys[i]] = add[keys[i]];
		}
		return origin;
	}
}