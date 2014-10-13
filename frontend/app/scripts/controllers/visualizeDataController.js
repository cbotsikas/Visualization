App.VisualizeDataController = Ember.ArrayController.extend({
    needs: ["application"],
    applicationController: Ember.computed.alias("controllers.application"),
    dataInfo: {},
    dataSubset: null,
    dimensions: function() { // computed property; die wird den childviews übergeben      
        var dataSubset = this.get('dataSubset');
        if (!dataSubset) {
            return [];
        }

        var properties = _.values(dataSubset.properties);
        console.log("CHANGED PROPERTIES");
        console.dir(properties);
        return properties;
    }.property('dataSubset'),
    q: null,
    visualisationWidget: null,
    visualisationContainer: "visualisation", // div, visualisation.hbs
    visualisationConfiguration: {},
    createOptionViews: function(options, visualisationConfiguration, observer, container) {
        console.log("### CREATE VISUALISATION CONFIGURATION VIEW");
        console.log('OPTIONS');
        console.dir(options);

        for (var optionName in options) {
            var option = options[optionName];
            var view;

            console.log('OPTION NAME: ' + optionName);
            console.log('OPTION MAP');
            console.dir(option);

            if (!visualisationConfiguration[optionName]) {
                visualisationConfiguration[optionName] = this.getOptionDefaultValue(option);
            }

            if (option.suboptions) {
                view = Ember.View.create({
                    tagName: "li",
                    templateName: "vistemplates/" + option.template,
                    name: optionName,
                    parent: container,
                    childrenConfig: visualisationConfiguration[optionName],
                    label: option.label,
                    optionvalue: option,
                    classNames: "optionContainer",
                    childrenViews: [],
                    pushObject: function(child) {
                        console.log("Pushed " + child.name + " into " + this.name)
                        this.childrenViews.push(child);
                    }
                });
                this.createOptionViews(option.suboptions, visualisationConfiguration[optionName], observer, view);
            } else {
                var view = Ember.View.extend({
                    tagName: "li",
                    templateName: "vistemplates/" + option.template,
                    name: optionName,
                    values: option.values,
                    label: option.label,
                    optionvalue: option,
                    parent: container,
                    content: visualisationConfiguration[optionName], // initial value; later user input
                    contentObserver: observer.observes('content')
                }).create();
            }
            container.pushObject(view);
        }
        console.log("###########");
    },
    getOptionDefaultValue: function(option) {
        switch (option.template) {
            case 'treeView':
            case 'box':
                return {};
            case 'area':
                return [];
            case 'selectField':
                return option.values[0];
            default:
                return "";
        }
    },
    getWidget: function(widgetName) {
        switch (widgetName) {
            case 'Bar Chart':
                return barchart;
            case 'Column Chart':
                return columnchart;
            case 'Line Chart':
                return linechart;
            case 'Area Chart':
                return areachart;
            case 'Pie Chart':
                return piechart;
            case 'Bubble Chart':
                return bubblechart;
            case 'Scatter Chart':
                return scatterchart;
            case 'Map Chart':
                return mapchart;
            case 'Map':
                return map;
        }
        return null;
    },
    getDataModule: function(datasource) {
        var format = datasource.get('format');
        switch (format) {
            case 'csv':
                return csv_data_module;
            case 'rdf':
                return sparql_data_module;
        }
        console.error("Unknown data format '" + format + "'");
        return null;
    },
    treeContent: {},
    scrollTo: function(id) {
        Ember.$('html,body').animate({
            scrollTop: $("#" + id).offset().top
        });
    },
    actions: {
        selectDS: function(ds) {
            console.log("Selected DS " + ds.get('name'));
            console.dir(ds)
            this.set('selectedDatasource', ds);
            var controller = this;
            Ember.$.getJSON('http://localhost:3001/suggest/' + ds.get('id')).then(function(tools) {
                console.log('visualization route');
                console.log(tools);
                controller.set('suggestedTools', tools);
            });
        },
        configure: function(selection) {
            console.log("### CONFIGURE VISUALISATION")

            Ember.View.views['tuningOptionsView'].clear();
            Ember.View.views['structureOptionsView'].clear();
            Ember.$('#visualisation').empty();

            var controller = this;
            var visualisationConfiguration = {};
            this.set('visualisationConfiguration', visualisationConfiguration)

            var dataset = this.get('selectedDatasource');
            console.log("SELECTED DATASOURCE");
            console.dir(dataset);
            console.log("FORMAT");
            console.log(dataset.get('format'));
            console.log("LOCATION");
            console.log(dataset.get('location'));

            var visualisationWidget = this.getWidget(selection.name);
            console.log("SELECTION");
            console.dir(selection);

            this.set('visualisationWidget', visualisationWidget);
            console.log("SELECTED WIDGET");
            console.dir(visualisationWidget);

            var module = this.getDataModule(dataset);
            console.log("MODULE");
            console.dir(module);

         
            var structureOptions = selection.structureOptions || visualisationWidget.structureOptions;
            console.log("OPTIONS");
            console.dir(structureOptions);
            console.log("SELECTION");
            console.dir(selection);

            // retrieve pre-configuration from backend
            var dataset_id = dataset.id;
            var visualization_id = selection._id;

            var promise = Ember.$.getJSON('http://localhost:3001/preconfigure/' + dataset_id + "/" + visualization_id);

            return promise.then(function(preconfig) {
                console.log("RETRIEVE PRECONFIGURATION");
                console.dir(preconfig);
                controller.set('visualisationConfiguration', preconfig);
                 preconfig.dataModule = module;

                // read data from backend and create a data tree
                module.read(dataset.get("location")).then(function(datasourceInfo) {
                    var dataInfo = datasourceInfo.dataInfo;
                    controller.set('treeContent', tree_data.create(dataInfo));

                    preconfig.datasourceInfo = datasourceInfo; // TODO: vielleicht reicht ja das data module
                });

                var observer = function() {
                    console.log("CONFIG VIS OBSERVER");
                    console.log("setting " + this.get('name') + " to: ");
                    var parent = this.get('parent');
                    var childrenConfig = parent.childrenConfig;
                    childrenConfig[this.get('name')] = this.get('content');
                    console.log("USER SELECTION");
                    console.dir(this.get('content'));
                    console.log("CHILDREN CONFIG");
                    console.dir(childrenConfig);
                };

            var optionsContainer = Ember.View.views['structureOptionsView'];
                optionsContainer.clear();
                optionsContainer.childrenConfig = preconfig;

                // create preconfigured option view
                controller.createOptionViews(structureOptions, preconfig, observer, optionsContainer);
            });

            console.log("###########");
            this.scrollTo("wf-init-vis");
        },
        draw: function() {
            console.log("### DRAW VISUALISATION");
            var visualisationWidget = this.get('visualisationWidget');
            var visualisationConfiguration = this.get('visualisationConfiguration');
            var visualisationContainer = this.get('visualisationContainer');

            console.log('SUBSET DRAW');
            console.dir(this.get('dataSubset'));
            visualisationConfiguration.selectedSubset = this.get('dataSubset');

            visualisationWidget.draw(visualisationConfiguration, visualisationContainer);

            var options = visualisationWidget.tuningOptions;

            var observer = function() {
                console.log("OBSERVER - TUNE");
                console.log("setting " + this.get('name') + " to: ");
                console.dir(this.get('content'));
                var parent = this.get('parent');
                var childrenConfig = parent.childrenConfig;
                childrenConfig[this.get('name')] = this.get('content');
                visualisationWidget.tune(visualisationConfiguration);
                console.log("CHILDREN CONFIG");
                console.dir(childrenConfig);
            };

            var container = Ember.View.views['tuningOptionsView'];
            container.clear();
            container.childrenConfig = visualisationConfiguration;
            this.createOptionViews(options, visualisationConfiguration, observer, container);

            this.scrollTo("wf-show-vis");
            console.log("###########");
        }
    }
});