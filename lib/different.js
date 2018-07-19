const core  = require('./core');

module.exports = {
	getFolders: async function(options){
		if(!options){
			options = {};
		}
		
		options.objectType   = 'DataFolder';
		options.properties   = ['Name', 'CustomerKey', 'ID', 'ParentFolder.ID', 'Client.ID'];
		
		var all 	         = {};
		var rootElement      = {
			id:			  null,
			customerKey:  null,
			parent:		  null,
			name: 		  'ROOT',
			children: 	  []
		};
		
		var result 	         = [rootElement];

		var list = await core.retrieve(options);

		list.map(function(i){
			var key = '_' + i.Client.ID + '_' + i.ID;
			var keyParent = '_' + i.Client.ID + '_' + i.ParentFolder.ID;
			
			var element = {
				id:			  i.ID,
				parent:		  i.ParentFolder.ID,
				customerKey:  i.CustomerKey,
				name: 		  i.Name,
				code:         i.ID,
				children:     all[key] ? all[key].children : []
			}

			all[key] = element;

			if(!all[keyParent]){
				all[keyParent] = {
					id:       i.ParentFolder.ID,
					name:     i.Client.ID,
					children: []
				};
			}

			all[keyParent].children.push(element);

			if(all[keyParent].id == 0 && !all[keyParent].added){
				all[keyParent].added = true;
				rootElement.children.push(all[keyParent]);
			}
		});

		return rootElement;
	},

	getFolders: async function(options){
		options.objectType   = 'DataFolder';
		options.properties   = ['Name', 'CustomerKey', 'ID', 'ParentFolder.ID', 'Client.ID'];

		let list = await core.retrieve(options);

		return list;
	},

	/**
	 * @param  {} options
	 * { options.path, }
	 */
	createPath: async function(options){
		let folderSegments = options.path.split('/');
		
		
		this.createFolders()
	},

	/**
	 * @param  {object} folder
	 * 
	 */
	createFolder: async function(folder){
		if(folder.isTopLevel){
			folder.ParentFolder = {ID: 0};
		}
		
		let createOptions = {
			objectType: 'DataFolder',
			objects: [folder]
		};

		let result = await core.create(createOptions);

		return result;
	},

	getBusinessUnits: async function(){
		var options = {};

		options.objectType   = 'BusinessUnit';
		options.properties   = ['Name', 'ID', 'BrandID', 'DBID'];

		var list = await core.retrieve(options);

		return list;
	}
}