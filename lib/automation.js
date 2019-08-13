var core = require('./core');

var utils = require('./utils');

module.exports = {
	getAutomations: async function (options) {
		options.objectType = 'Program';

		if (!options.properties) {
			options.properties = [
				'CustomerKey',
				'Name',
				'ObjectID'
			];
		}

		var result = await core.retrieve(options);

		for (var i = 0; i < result.length; i++) {
			var element = result[i];
			delete element["PartnerKey"];
		};

		return result;
	}
}