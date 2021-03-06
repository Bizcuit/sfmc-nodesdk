const http            = require('http');
const https           = require('https');
const url             = require('url');
const querystring     = require('querystring');
const xml2js          = require('xml2js');
const zlib            = require('zlib');

var builder = new xml2js.Builder({
	headless:        true,
	explicitRoot:    false,
	attrkey:         '@',
	rootName:        "soapenv:Envelope"
});

var envelopeTemplate = {
	"@": {
		"xmlns:soapenv":  "http://schemas.xmlsoap.org/soap/envelope/",
		"xmlns:xsi":      "http://www.w3.org/2001/XMLSchema-instance"
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

var httpLayer = {
	prepareSoapEnvelope: function(requestName, request, header){
		envelopeTemplate["soapenv:Header"]    = header;
		envelopeTemplate["soapenv:Body"]      = {};
		envelopeTemplate["soapenv:Body"][requestName]        = request;
		envelopeTemplate["soapenv:Body"][requestName]["@"]   = { xmlns: 'http://exacttarget.com/wsdl/partnerAPI' };

		return builder.buildObject(envelopeTemplate);
	},

	executeSoapCall: function(action, requestName, request, config){
		var url       = config.stack == "1" ? 'https://webservice.exacttarget.com/Service.asmx' : `https://webservice.s${config.stack}.exacttarget.com/Service.asmx`;
		var envelope  = this.prepareSoapEnvelope(requestName, request, config.soapHeader);
		var headers   = {
			'Content-Type'  : 'text/xml',
			'SOAPAction'	: action
		};

		return this.executeHttpCall(url, 'POST', envelope, headers)
		.then((stringResult) => {
			return new Promise((resolve, reject) => {
				xml2js.parseString(stringResult, {ignoreAttrs: true, explicitArray: false}, function(err, outputObject){
					if(err){
						reject(err);
					}
					else{
						resolve(outputObject['soap:Envelope']['soap:Body']);
					}
				});
			});
		})
		.catch(err => {
			return Promise.reject(err);
		});
	},

	executeHttpCall: function(uri, method, body, headers){
		var options      = url.parse(uri);
		options.method   = method;
		options.headers  = headers;

		var client = (options.protocol === 'https:' ? https : http);
		var bodyText = (typeof body == 'object' ? JSON.stringify(body) : body);

		return new Promise((resolve, reject) => {
			var req = client.request(options, (res) => {
				var chunks = [];
				
				res.on('data', (data) => { chunks.push(data); });
				res.on('end', () => {
					var buffer = Buffer.concat(chunks);

					if(res.headers['content-encoding'] == 'gzip'){
						zlib.gunzip(buffer, function(err, output){
							if(!err && res.statusCode >= 200 && res.statusCode < 300){
								resolve(output.toString());
							}
							else{
								reject(err);
							}
						});
					}
					else{
						var output = buffer.toString();;
						if(res.statusCode >= 200 && res.statusCode < 300){
							resolve(output);
						}
						else{
							reject(output);
						}
					}
				});
			});

			req.on('error', (err) => { 
				reject(err); 
			});
			
			if(bodyText){
				req.write(bodyText);
			}
			
			req.end();
		});
	}
};

module.exports = httpLayer;