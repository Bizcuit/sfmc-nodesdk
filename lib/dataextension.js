var core  = require('./core');

module.exports = {

	//options = single DE or an array {Name, CustomerKey, Fields}
	createDataextensions: async function(options){
		var clone = JSON.parse(JSON.stringify(options));
		var des   = Array.isArray(clone) ? clone : [clone]

		des.forEach(e => {
			var fields = e.Fields.sort((a, b) => {
				return (a.Ordinal && b.Ordinal) ? (a.Ordinal - b.Ordinal) : 0;
			});

			fields.forEach(e => {
				delete e.ObjectID;
			});

			delete e.Fields;
			e.Fields = {
				Field: fields
			}

			if(e.SendableSubscriberField && e.SendableSubscriberField.Name){
				e.SendableSubscriberField.Name = e.SendableSubscriberField.Name.replace("_SubscriberKey", "Subscriber Key");
			}
		});
		
		var createOptions = {
			objectType: 'DataExtension',
			objects: des
		};

		var result = await core.create(createOptions);
		
		return result;
	},

	getDataextensionKeyByName: async function(options){
		if(options.dataextensionKey){
			return options.dataextensionKey;
		}

		var dataextensions = await this.getDataextensions({
			columns:             ['CustomerKey'],
			mid:                 options.mid,
			filter:              {
				Property:          'Name',
				SimpleOperator:    'equals',
				Value:             options.dataextensionName
			}
		});

		if(!dataextensions || dataextensions.length != 1){
			throw "Dataextension not found or ambiguous";
		}
		
		return dataextensions[0].CustomerKey;
	},

	// options = {filter, withColumns?}
	getDataextensions: async function(options){
		options.objectType    = 'DataExtension';

		if(!options.properties){
			options.properties    = [
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

		var result            = await core.retrieve(options);
		var columnsPromises   = [];
		var that              = this;

		for(var i = 0; i < result.length; i++){
			var element = result[i];
			delete element["PartnerKey"];
			if(options.withColumns){
				//element.Fields = await that.getColumns({dataextensionKey: element.CustomerKey});
				columnsPromises.push(new Promise(async (resolve, reject) => {
					element.Fields = await that.getColumns({dataextensionKey: element.CustomerKey});
					resolve(element.Fields);
				}));
			}
		};

		if(options.withColumns){
			var values = await Promise.all(columnsPromises);
		}

		return result;
	},

	// options = {dataextensionKey or dataextensionName}
	getColumns: async function(options){
		options.objectType = 'DataExtensionField';

		if(!options.properties){
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
		
		var dataextensionKey = await this.getDataextensionKeyByName(options);

		options.filter = {
			Property:          'DataExtension.CustomerKey',
			SimpleOperator:    'equals',
			Value:             dataextensionKey
		};

		var result = await core.retrieve(options);

		result.forEach((e) => {
			delete e["PartnerKey"];
		});

		return result;
	},

	// options = {dataextensionKey or dataextensionName, columns or empty for all} 
	getRows: async function(options){
		options.dataextensionKey = await this.getDataextensionKeyByName(options);
		
		if(!options.columns){
			var columnsList = await this.getColumns({
				dataextensionKey:  options.dataextensionKey,
				properties:        ['Name'],
				mid:               options.mid
			});
			
			options.properties = columnsList.map((i) => {
				return i.Name;
			});
		}
		else{
			options.properties = options.columns;
		}


		options.objectType   = `DataExtensionObject[${options.dataextensionKey}]`;
		var propertiesRows   = await core.retrieve(options);
		return propertiesRows.map(this._fromPropertiesToDatarow);
	},

	// options = {dataextensionKey, rows, saveAction}
	updateRows: async function(options){
		var dataextensionKey  = await this.getDataextensionKeyByName(options);
		
		options.saveAction    = options.saveAction || 'UpdateAdd';
		options.objectType    = 'DataExtensionObject';
		options.objects       = options.rows.map((row) => {
			var dr = {
				CustomerKey:   dataextensionKey,
				Properties:    this._fromDatarowToProperties(row)
			};
			return dr;
		});

		var result = await core.update(options);

		return result;
	},

	deleteRows: function(dataExtensionKey, key, options){
		throw Error('Not implemented');
	},

	_fromPropertiesToDatarow: function(propertiesRow){
		var dr = {};
		var arr = null;

		if(Array.isArray(propertiesRow.Properties.Property)){
			arr = propertiesRow.Properties.Property;
		}
		else{
			arr = [propertiesRow.Properties.Property];
		}
		
		arr.forEach(function(e){
			dr[e.Name] = e.Value;
		}, this);

		return dr;
	},

	_fromDatarowToProperties: function(objectRow){
		var properties   = {};
		var keys         = Object.keys(objectRow);
		
		properties.Property = keys.map((key) => {
			return {
				Name:    key,
				Value:   objectRow[key]
			};
		});

		return properties;
	}

}