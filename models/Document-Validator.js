var DocValidator = function()
{  
    var self = this;
    
    // External libraries
    var async = require("async");
    var xslt4node = require('xslt4node');
    var XRegExp = require('xregexp');
    var docxtemplater = require('docxtemplater');
    var fs = require('fs');
    var mime = require('mime');
    var vm = require('vm');
    var path = require('path');
    var xpath = require('xpath');
    var xmlbuilder = require('xmlbuilder');
    var AdmZip = require('adm-zip');
    var Saxon = require('saxon-stream');
    var Readable = require('stream').Readable;
    var dom = require('xmldom').DOMParser;
    
    include("ooxml_libs/linq.js");
    include("ooxml_libs/ltxml.js");
    include("ooxml_libs/ltxml-extensions.js");
    include("ooxml_libs/jszip.js");
    include("ooxml_libs/jszip-load.js");
    include("ooxml_libs/jszip-inflate.js");
    include("ooxml_libs/jszip-deflate.js");
    include("ooxml_libs/openxml.js");   
   
    function include(path)
    {  
        var code = fs.readFileSync(path, 'utf-8');
        vm.runInThisContext(code, path);
    };
    
    // Global variables
    var Documents = [], SyntheticalData, AnalyticalData, AllRules, ValidationResults = [];
    var uploadsDirectory = path.resolve(__dirname, '../public/uploads');
    var templateDirectory = path.resolve(__dirname, '../templates');
    var generatedDirectory = path.resolve(__dirname, '../generated');
    var RulesDirectory = path.resolve(__dirname, '../xml/rules');
    var extractedFolder = path.join(uploadsDirectory, "extracted");
    var saxonPath = path.resolve(__dirname, '../saxon/saxon9he.jar');

    var namespaces =
    {
        "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
        "v" : "urn:schemas-microsoft-com:vml"
    };

    // Get all directories name within a given path.
    function getDirectories(srcpath)
    {
        return fs.readdirSync(srcpath).filter(function(file)
        {
            return fs.statSync(path.join(srcpath, file)).isDirectory();
        });
    }

    // Validate the XML istance against the XML Schema.
    function validateXmlFile(rule)
    {
        return true; // TODO
    }
  
    
    // Validate the document against a set of rules.
    self.validate = function(rule, document, callbackRule)
    {
        // Get the rule filename.
        var fileName = AllRules[rule];

        // Parse the XML file.
        var rulePath = path.join(RulesDirectory, fileName);
        var ruleString = fs.readFileSync(rulePath).toString();
        var ruleDom = new dom().parseFromString(ruleString);
        
        // Get rule name and description.
        var ruleDescription = xpath.select("//description/text()", ruleDom).toString();
        var ruleName = xpath.select("//name/text()", ruleDom).toString();
        
        // Distinguish between Collect-And-Check and Collect-And-Compare rules.
        var ruleType = xpath.select("/rule/@type", ruleDom)[0].value;
        var collectValue, collectType;
 
        switch (ruleType)
        {
            case 'collect-and-check': collectAndCheck(); break;
            case 'collect-and-compare': collectAndCompare(); break;
        }
        
        function collectAndCheck()
        {
            var asyncItems = [];
            async.series(
            [
                function(callback)
                {
                    collectType = xpath.select("//collect/@type", ruleDom)[0].value;
                    collectValue = xpath.select("//collect/*", ruleDom).toString();
                    performCollect(collectType, collectValue, asyncItems, callback);
                }
            ],
            function(err)
            { 
                if (err) return next(err);
                
                var results = performCheck(asyncItems[0]);

                ValidationResults.push(
                { 
                    'document' : document.Name, 
                    'name' : ruleName, 
                    'description' : ruleDescription, 
                    'results' : results 
                });
                callbackRule();
            });
        }
        
        function parseResults(items)
        {
            // Get the items.
            var itemsDom = new dom().parseFromString(items);
            
            var children = itemsDom.firstChild.childNodes;
            var results = [];
            var index = 0;
            for (var i = 0; i < children.length; i++)
            {
                var child = children[i];
                if (child.nodeName == 'item')
                {
                    var item = {};
                    item["index"] = index;
                    index++;
                    var subchildren = child.childNodes;
                    for (var j = 0; j < subchildren.length; j++)
                        if (subchildren[j].nodeName == 'value')
                            item["value"] = subchildren[j].firstChild.nodeValue;
                    item["valid"] = child.attributes[0].nodeValue;
                    
                    results.push(item);
                }
            }

            return results;
        }
        
        function collectAndCompare()
        {
            var items1, items2;
            var asyncItems = [];
            async.series(
            [
                function(callback)
                {
                    collectType = xpath.select("//collect/items[@i='1']/@type", ruleDom)[0].value;
                    collectValue = xpath.select("//collect/items[@i='1']/*", ruleDom).toString();
                    performCollect(collectType, collectValue, asyncItems, callback);
                },
                function(callback)
                {
                    collectType = xpath.select("//collect/items[@i='2']/@type", ruleDom)[0].value;
                    collectValue = xpath.select("//collect/items[@i='2']/*", ruleDom).toString();
                    performCollect(collectType, collectValue, asyncItems, callback);
                }
            ],
            function(err)
            { 
                if (err) return next(err);

                // Unify the two collections in a single tree.
                var xmlString = "<collect>" + asyncItems[0] + asyncItems[1] + "</collect>";
                
                var results = performCompare(xmlString);
                var parsedResults = parseResults(results);
                ValidationResults.push(
                { 
                    'document' : document.Name, 
                    'name' : ruleName, 
                    'description' : ruleDescription, 
                    'results' : parsedResults 
                });
                callbackRule();
            });
        }
        
        // Collect the items to verify against a rule.
        function performCollect(type, value, asyncItems, callback)
        {
            // Distinguish among the rule types.
            switch (type)
            {
                case 'Regex':  collectRegex(); break;
                case 'XPath':  collectXPath(); break;
                case 'XSLT 1': collectXSLT1(); break;     
                case 'XSLT 2': collectXSLT2(); break;  
                case 'XQuery':       
            }
            
            function collectXSLT2()
            {
                var xslPath = path.resolve(__dirname, '../saxon/xslPath.xsl');
                fs.writeFileSync(xslPath, value, 'utf8');
                var saxon = new Saxon(saxonPath);
                saxon.on('error', function(err){ console.log(err) });
                var readerStream = fs.createReadStream(document.Path).pipe(saxon.xslt(xslPath));
                var data = '', once = false;
                
                readerStream.on('data', (chunk) =>
                {
                    data += chunk;
                });
                
                readerStream.on('end', () =>
                {
                    if (once) return;
                    once = true;
                    asyncItems.push(data);
                    callback();
                });
            }
            
            function collectXSLT1()
            {
                var config =
                {
                    xslt: value,
                    source: document.Text,
                    result: String,
                    props: { indent: 'yes' }
                };
                asyncItems.push(xslt4node.transformSync(config));
                callback();
            }
            
            function collectRegex()
            {
                // Create the root element.
                var xml = xmlbuilder.create('items', { headless: true });
                
                // Add the children elements.
                var value = xpath.select("//collect/text()", ruleDom).toString();
                var expression = XRegExp(value);
                XRegExp.forEach(document.Text, expression, function(match, i)
                {
                    xml.ele('item', {'i': i}, match[0]);
                });
                xml.end(xmlbuilder.stringWriter());
                asyncItems.push(xml.toString());
                callback();
            }
            
            function collectXPath()
            {
                // Create the root element.
                var xml = xmlbuilder.create('items', { headless: true });
                
                // Add the children elements. 
                var nodes = xpath.select(value, document.DOM)
                for (var i = 0; i < nodes.length; i++)
                    xml.ele('item', {'i': i}, nodes[i]);
                xml.end(xmlbuilder.stringWriter());
                
                asyncItems.push(xml.toString());
                callback();
            } 
        }    
           
        // Compare two lists of items against a rule.
        function performCompare(collect)
        {
            var compareType = xpath.select("//compare/@type", ruleDom)[0].value;
            var compareValue = xpath.select("//compare/*", ruleDom).toString();
            
            switch (compareType)
            {
                case 'XSLT 1': return compareXSLT1();
            }

            function compareXSLT1()
            {
                var config =
                {
                    xslt: compareValue,
                    source: collect,
                    result: String,
                    props: { indent: 'yes' }
                };
                
                return xslt4node.transformSync(config);
            }
        }
            
        // Check the given items against a rule.
        function performCheck(items)
        {
            var checkType = xpath.select("//check/@type", ruleDom)[0].value;
            var checkValue = xpath.select("//check/text()", ruleDom).toString();

            // Get the items.
            var itemsDom = new dom().parseFromString(items);
            
            switch (checkType)
            {
                case 'Regex': return checkRegex();
            }
            
            // Validate the items against a regular expression.
            function checkRegex()
            {
                var children = itemsDom.firstChild.childNodes;
                var rule = XRegExp(checkValue);
                var results = [];
                for (var i = 0; i < children.length; i++)
                {
                    var child = children[i];
                    if (child.nodeName == 'item')
                    {
                        var item = {};
                        item["index"] = (child.attributes)? child.attributes[0].nodeValue : "";
                        item["value"] = (child.firstChild)? child.firstChild.nodeValue : "";
                        item["valid"] = rule.test(item["value"]);
                        results.push(item);
                    }
                }
                
                return results;
            }
        }
    }
    
    function prepareViewsData()
    {
        // Create Synthetical and Analytical View data.
        AnalyticalData = {'Results' : []};
        SyntheticalData = {'Results' : []};
        var document, rule, name, results, matches, failed, result;
        for (var i = 0; i < ValidationResults.length; i++)
        {
            rule = ValidationResults[i];
            document = rule['document'];
            name = rule['name'];
            results = rule['results'];
            matches = results.length;
            failed = 0;
            for (var j = 0; j < matches; j++)
            {
                if (!results[j]['valid'] || results[j]['valid'] == 'false')
                    failed++;
                result = results[j];
                AnalyticalData.Results.push(
                {
                    'Document': document, 
                    'Rule': name, 
                    'Index': result['index'], 
                    'Value': result['value'], 
                    'Passed': result['valid']
                });
            }
            SyntheticalData.Results.push({'Document': document, 'Rule': name, 'Total': matches, 'Failed': failed});
        }
    }
    
    // Validate the document against the selected rules.
    self.fireRules = function(rules, response)
    {
        ValidationResults = [];

        async.forEach(Documents, function(document, callbackDocument)
        {
            async.forEach(rules, function(rule, callbackRule)
            {
                self.validate(rule, document, callbackRule);
            },
            function(err)
            {
                callbackDocument();
            });
        },
        function(err)
        {
            prepareViewsData();
            
            response.send({ 'AnalyticalData' : AnalyticalData, 'SyntheticalData' : SyntheticalData });
        });
    }
    
    // Set the document to validate.
    self.SetDocument = function(fileName, type)
    {
        Documents = [];
        var files = [];

        // Construct the absolute path.
        fileName = "" + fileName;
        var filePath = path.join(uploadsDirectory, fileName);
        
        // Set the DOM Parser.
        Ltxml.DOMParser = dom;
        
        // Check if it is a ZIP file.
        if (type == 'application/zip, application/octet-stream')
        {
            // Remove old files.
            if (fs.existsSync(extractedFolder))
            {
                fs.readdirSync(extractedFolder).forEach(function(file, index)
                {
                    var filePath = path.join(extractedFolder, file);
                    fs.unlinkSync(filePath);
                });
            }
                
            // Extract the files.
            var zip = new AdmZip(filePath);
            zip.extractAllTo(extractedFolder);
            
            // Get all the file names.
            var extractedFiles = fs.readdirSync(extractedFolder);
            extractedFiles.forEach(function(fileName, index)
            {
                var filePath = path.join(extractedFolder, fileName);
                var type = mime.lookup(filePath);
                if (type == 'application/xml' ||
                    type == 'text/xml' ||
                    type == 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
                    files.push({ Path : filePath, Name : fileName, Type : type });    
            });
            
            // Destroy the ZIP file.
            fs.unlink(filePath);
        }
        else
        {
            files.push({ Path : filePath, Name : fileName, Type : type });
        }
        
        var documentString;
        for (var i = 0; i < files.length; i++)
        {
            var file = files[i], documentPath;
            
            // Distinguish between DOCX and XML files.
            switch (file.Type)
            {
                // Case XML file.
                case 'application/xml':
                case 'text/xml':
                    documentString = fs.readFileSync(file.Path, 'utf-8').toString();
                    documentPath = file.Path;
                    break;
                // Case DOCX file.
                case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
                    // Read the document as base 64.
                    //var fileString = fs.readFileSync(file.Path).toString('base64');
                    
                    // Open the document.
                    //var doc = new openXml.OpenXmlPackage(fileString);
                    
                    // Extract the main part.
                    //var mainPart = doc.mainDocumentPart();

                    // Set the document as the DOCX main part.
                    //documentString = mainPart.data;
                    
                    var zip = new AdmZip(file.Path);
                    var basename = path.basename(file.Path, '.docx');
                    var folderPath = path.join(uploadsDirectory, basename);
                    zip.extractAllTo(folderPath);
                    documentPath = path.join(folderPath, 'word/document.xml');
                    documentString = fs.readFileSync(documentPath, 'utf-8').toString();
                    
                    break;
                default:
                    continue;
            }

            // Set the variable holding the document.
            Documents.push({ Path : documentPath, Name : file.Name, Text : documentString, DOM : new dom().parseFromString(documentString) });
            
            // Destroy the temporary file.
            //fs.unlink(file.Path);
        }

        return true;
    }
    
    self.DownloadSyntheticalView = function()
    {
        // Open the template.
        var templatePath = path.join(templateDirectory, "SyntheticalView.docx");
        var template = fs.readFileSync(templatePath, "binary");
        
        // Get the data.
        var templater = new docxtemplater(template);
        templater.setData(SyntheticalData);
        templater.render();
        var fileBuffer = templater.getZip().generate({ type: "nodebuffer" });
        var filePath = path.join(generatedDirectory, "SyntheticalView.docx");
        fs.writeFileSync(filePath, fileBuffer);
            
        return filePath;
    }
    
    self.DownloadAnalyticalView = function()
    {
        // Open the template.
        var templatePath = path.join(templateDirectory, "AnalyticalView.docx");
        var template = fs.readFileSync(templatePath, "binary");
        
        // Get the data.
        var templater = new docxtemplater(template);
        templater.setData(AnalyticalData);
        templater.render();
        var fileBuffer = templater.getZip().generate({ type: "nodebuffer" });
        var filePath = path.join(generatedDirectory, "AnalyticalView.docx");
        fs.writeFileSync(filePath, fileBuffer);
            
        return filePath;
    }

    self.GetRules = function()
    {
        // Get all the rules.
        var rulePaths = fs.readdirSync(RulesDirectory);
        
        // Construct the list of metadata.
        AllRules = {};
        var data = [];
        for (var i = 0; i < rulePaths.length; i++)
            data.push(getMetadata(rulePaths[i]));
        
        return { "data" : data };
        
        // Retrieve the metadata from a given Rule Set directory.
        function getMetadata(rulePath)
        {
            // Construct the absolute path to the metadata.
            var filePath = path.join(RulesDirectory, rulePath);

            // Open the file.
            var fileString = fs.readFileSync(filePath).toString();

            // Get the DOM.
            var fileDom = new dom().parseFromString(fileString);

            // Get the metadata.
            var name = xpath.select("/rule/name/text()", fileDom).toString();
            var description = xpath.select("/rule/description/text()", fileDom).toString();
            var target = xpath.select("/rule/target/@type", fileDom).value;
            
            // Populate the global variable.
            AllRules[name] = rulePath;
            
            return [name, description];
        }
    }
};

module.exports = DocValidator;