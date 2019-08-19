const core = require('./core');

module.exports = {

	//options = single DE or an array {Name, CustomerKey, Fields}
	createDataextensions: async function (options) {
		let clone = JSON.parse(JSON.stringify(options));
		let des = Array.isArray(clone) ? clone : [clone]

		des.forEach(e => {
			let fields = e.Fields.sort((a, b) => {
				return (a.Ordinal && b.Ordinal) ? (a.Ordinal - b.Ordinal) : 0;
			});

			fields.forEach(e => {
				delete e.ObjectID;
			});

			delete e.Fields;
			e.Fields = {
				Field: fields
			}

			if (e.SendableSubscriberField && e.SendableSubscriberField.Name) {
				e.SendableSubscriberField.Name = e.SendableSubscriberField.Name.replace("_SubscriberKey", "Subscriber Key");
			}
		});

		let createOptions = {
			objectType: 'DataExtension',
			objects: des
		};

		let result = await core.soapCreate(createOptions);

		return result;
	},

	getDataextensionKeyByName: async function (options) {
		if (options.dataextensionKey) {
			return options.dataextensionKey;
		}

		let dataextensions = await this.getDataextensions({
			properties: ['CustomerKey'],
			mid: options.mid,
			filter: {
				Property: 'Name',
				SimpleOperator: 'equals',
				Value: options.dataextensionName
			}
		});

		if (!dataextensions || dataextensions.length != 1) {
			throw "Dataextension not found or ambiguous";
		}

		return dataextensions[0].CustomerKey;
	},

	// options = {filter, withColumns?}
	getDataextensions: async function (options) {
		options.objectType = 'DataExtension';

		if (!options.properties) {
			options.properties = [
				'Client.ID',
				'CategoryID',
				'CustomerKey',
				'Name',
				'CreatedDate',
				'ModifiedDate',
				'IsSendable',
				'DataRetentionPeriodLength',
				'DataRetentionPeriodUnitOfMeasure',
				'DeleteAtEndOfRetentionPeriod',
				'ResetRetentionPeriodOnImport',
				'RetainUntil',
				'RowBasedRetention',
				'SendableDataExtensionField.Name',
				'SendableSubscriberField.Name',
				'Description'
			];
		}

		let result = await core.soapRetrieve(options);
		let columnsPromises = [];
		let that = this;

		for (let i = 0; i < result.length; i++) {
			let element = result[i];
			delete element["PartnerKey"];
			if (options.withColumns) {
				//element.Fields = await that.getColumns({dataextensionKey: element.CustomerKey});
				columnsPromises.push(new Promise(async (resolve, reject) => {
					element.Fields = await that.getColumns({
						mid: options.mid,
						dataextensionKey: element.CustomerKey
					});
					resolve(element.Fields);
				}));
			}
		};

		if (options.withColumns) {
			let values = await Promise.all(columnsPromises);
		}

		return result;
	},

	// options = {dataextensionKey or dataextensionName}
	getColumns: async function (options) {
		options.objectType = 'DataExtensionField';

		if (!options.properties) {
			options.properties = [
				'Name',
				'FieldType',
				'ObjectID',
				'MaxLength',
				'Scale',
				'IsRequired',
				'IsPrimaryKey',
				'DefaultValue',
				'Ordinal'
			];
		}

		let dataextensionKey = await this.getDataextensionKeyByName(options);

		options.filter = {
			Property: 'DataExtension.CustomerKey',
			SimpleOperator: 'equals',
			Value: dataextensionKey
		};

		let result = await core.soapRetrieve(options);

		result.forEach((e) => {
			delete e["PartnerKey"];
		});

		if (result && result.length && result[0].Ordinal !== null) {
			result = result.sort((a, b) => {
				return (a.Ordinal && b.Ordinal) ? (a.Ordinal - b.Ordinal) : 0;
			});
		}

		return result;
	},

	// options = {dataextensionKey or dataextensionName, columns or empty for all} 
	getRows: async function (options) {
		options.dataextensionKey = await this.getDataextensionKeyByName(options);

		if (!options.columns) {
			let columnsList = await this.getColumns({
				dataextensionKey: options.dataextensionKey,
				properties: ['Name', 'Ordinal'],
				mid: options.mid
			});

			options.columns = columnsList.map((i) => {
				return i.Name;
			});

			options.columns.push("_CustomObjectKey");
		}

		options.properties = options.columns;
		options.objectType = `DataExtensionObject[${options.dataextensionKey}]`;

		let propertiesRows = await core.soapRetrieve(options);

		return {
			columns: options.properties,
			rows: propertiesRows.map(this._fromPropertiesToDatarow)
		};
	},

	// options = {dataextensionKey, rows, saveAction, mid}
	updateRows: async function (options) {
		let dataextensionKey = await this.getDataextensionKeyByName(options);

		options.saveAction = options.saveAction || 'UpdateAdd';
		options.objectType = 'DataExtensionObject';
		options.objects = options.rows.map((row) => {
			let dr = {
				CustomerKey: dataextensionKey,
				Properties: this._fromDatarowToProperties(row)
			};

			if (options.mid) {
				dr.Client = {
					ID: options.mid
				};
			}

			return dr;
		});

		let result = await core.soapUpdate(options);

		return result;
	},

	deleteRows: function (dataExtensionKey, key, options) {
		throw Error('Not implemented');
	},


	_fromPropertiesToDatarow: function (propertiesRow) {
		let dr = {};
		let arr = null;

		if (Array.isArray(propertiesRow.Properties.Property)) {
			arr = propertiesRow.Properties.Property;
		}
		else {
			arr = [propertiesRow.Properties.Property];
		}

		arr.forEach(function (e) {
			dr[e.Name] = e.Value;
		}, this);

		return dr;
	},

	_fromDatarowToProperties: function (objectRow) {
		let properties = {};
		let keys = Object.keys(objectRow);

		properties.Property = keys.map((key) => {
			return {
				Name: key,
				Value: objectRow[key]
			};
		});

		return properties;
	}
}