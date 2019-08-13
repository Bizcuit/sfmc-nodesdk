const core = require('./core');
const utils = require('./utils');

module.exports = {
	createContentBlock: async function (options) {
		options = utils.extend({
			version: 2,
			assetType: {
				id: 197
			}
		}, options);

		let request = {
			endpoint: "asset/v1/content/assets",
			method: "POST",
			body: options
		};

		let response = await core.restExecute(request);

		return response;
	}
}
