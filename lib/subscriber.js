
var core  = require('./core');

module.exports = {
	//options = {subscriberKey, listID}
	unsubscribe: async function(options){
		options.saveAction  = 'update';
		options.subscribers = [{
			SubscriberKey: options.subscriberKey,
			Lists: {
				ID:      options.listID,
				Status:  'Unsubscribed',
				Action:  'update'
			}
		}];

		var result = await this.update(options);

		return result;
	},

	//options = {saveAction, subscribers}
	update: async function(options){
		options.objectType    = 'Subscriber';
		options.saveAction    = options.saveAction || 'UpdateAdd';
		options.objects       = subscribers;

		var result = await core.update(options);

		return result;
	}
};