const core = require('./core');
const utils = require('./utils');

module.exports = {
	getFolders: async function (options) {
		if (!options) {
			options = {};
		}

		options.objectType = 'DataFolder';
		options.properties = ['Name', 'CustomerKey', 'ID', 'ParentFolder.ID', 'Client.ID'];

		var all = {};
		var rootElement = {
			id: null,
			customerKey: null,
			parent: null,
			name: 'ROOT',
			children: []
		};

		var result = [rootElement];

		var list = await core.soapRetrieve(options);

		list.map(function (i) {
			var key = '_' + i.Client.ID + '_' + i.ID;
			var keyParent = '_' + i.Client.ID + '_' + i.ParentFolder.ID;

			var element = {
				id: i.ID,
				parent: i.ParentFolder.ID,
				customerKey: i.CustomerKey,
				name: i.Name,
				code: i.ID,
				children: all[key] ? all[key].children : []
			}

			all[key] = element;

			if (!all[keyParent]) {
				all[keyParent] = {
					id: i.ParentFolder.ID,
					name: i.Client.ID,
					children: []
				};
			}

			all[keyParent].children.push(element);

			if (all[keyParent].id == 0 && !all[keyParent].added) {
				all[keyParent].added = true;
				rootElement.children.push(all[keyParent]);
			}
		});

		return rootElement;
	},

	getFolder: async function (options) {
		options.objectType = 'DataFolder';
		options.properties = ['Name', 'CustomerKey', 'ContentType', 'ID', 'ParentFolder.ID', 'Client.ID'];

		let list = await core.soapRetrieve(options);

		return list;
	},

	/**
	 * @param  {} options
	 * { options.path, }
	 */
	createPath: async function (options) {
		let folderSegments = options.path.split('/');


		if (!options.parentFolderId) {
			let root = await this.getFolder({
				properties: ['ID'],
				mid: options.mid,
				filter: {
					Property: 'CustomerKey',
					SimpleOperator: 'equals',
					Value: utils.getRootFolderCustomKeyByType(options.type)
				}
			});

			if (root.length > 0) {
				options.parentFolderId = root[0]["ID"];
			}
		}

		if (!options.path || !folderSegments || folderSegments.length == 0) {
			return options.parentFolderId;
		}

		let newFolderName = folderSegments[0];
		let newFolderID = null;

		if (newFolderName) {
			/* START: Check if folder exists. If not, create */
			let newFolderList = await this.getFolder({
				properties: ['ID'],
				mid: options.mid,
				filter: {
					leftOperand: {
						Property: 'Name',
						SimpleOperator: 'equals',
						Value: newFolderName
					},
					rightOperand: {
						Property: 'ParentFolder.ID',
						SimpleOperator: 'equals',
						Value: options.parentFolderId
					},
					logicalOperator: "AND"
				}
			});

			if (newFolderList && newFolderList.length > 0) {
				newFolderID = newFolderList[0].ID;
			}
			else {
				let newFolder = await this.createFolder({
					Name: newFolderName,
					ContentType: options.type,
					ParentFolder: { ID: options.parentFolderId },
					Client: { ID: options.mid }
				});

				newFolderID = newFolder.NewID;
			}
		}

		return this.createPath({
			path: folderSegments.slice(1).join("/"),
			parentFolderId: newFolderID,
			mid: options.mid,
			type: options.type
		});
	},

	createFolder: async function (folder) {
		if (folder.isTopLevel) {
			folder.ParentFolder = { ID: 0 };
		}

		folder.AllowChildren = true;
		folder.IsActive = true;
		folder.IsEditable = true;
		folder.Description = "";

		let createOptions = {
			objectType: 'DataFolder',
			objects: [folder]
		};

		let result = await core.soapCreate(createOptions);

		return result;
	},

	getBusinessUnits: async function () {
		var options = {};

		options.objectType = 'BusinessUnit';
		options.properties = ['Name', 'ID', 'BrandID', 'DBID'];

		var list = await core.retrieve(options);

		return list;
	}
}