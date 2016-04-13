var DocValidator = function()
{  
    var self = this;
    
    // External libraries
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
    var Documents = [], SyntheticalData, AnalyticalData;
    var uploadsDirectory = path.resolve(__dirname, '../public/uploads');
    var templateDirectory = path.resolve(__dirname, '../templates');
    var generatedDirectory = path.resolve(__dirname, '../generated');
    var RulesDirectory = path.resolve(__dirname, '../xml/rules');
    var extractedFolder = path.join(uploadsDirectory, "extracted");
    var saxonPath = path.resolve(__dirname, '../saxon/saxon9he.jar');
    var saxon = new Saxon(saxonPath);
    saxon.on('error', function(err){ console.log(err) });

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
    self.validate = function(rulePath, documentIndex)
    {
        console.log('rulePath = ' + rulePath);
        console.log('documentIndex = ' + documentIndex);
        var document = Documents[documentIndex];
        
        // Parse the XML file.
        var ruleString = fs.readFileSync(rulePath).toString();
        var ruleDom = new dom().parseFromString(ruleString);
        
        // Get rule name and description.
        var description = xpath.select("//description/text()", ruleDom).toString();
        var name = xpath.select("//name/text()", ruleDom).toString();
        
        // Distinguish between Collect-And-Check and Collect-And-Compare rules.
        var ruleType = xpath.select("/rule/@type", ruleDom)[0].value;
        console.log('ruleType = ' + ruleType);
        var collectValue, collectType, results;
        switch (ruleType)
        {
            case 'collect-and-check':
                collectType = xpath.select("//collect/@type", ruleDom)[0].value;
                collectValue = xpath.select("//collect/*", ruleDom).toString();
                var items = performCollect(collectType, collectValue);
                results = performCheck(items);
                break;
            case 'collect-and-compare':
                collectType = xpath.select("//collect/items[@i='1']/@type", ruleDom)[0].value;
                collectValue = xpath.select("//collect/items[@i='1']/*", ruleDom).toString();
                console.log('collectType = ' + collectType);
                console.log('collectValue = ' + collectValue);
                var items1 = performCollect(collectType, collectValue);
                collectType = xpath.select("//collect/items[@i='2']/@type", ruleDom)[0].value;
                collectValue = xpath.select("//collect/items[@i='2']/*", ruleDom).toString();
                console.log('collectType = ' + collectType);
                console.log('collectValue = ' + collectValue);
                var items2 = performCollect(collectType, collectValue);
                break;
        }
        
        // Collect the items to verify against a rule.
        function performCollect(type, value)
        {
            // Distinguish among the rule types.
            switch (type)
            {
                case 'Regex':  return items = collectRegex();
                case 'XPath':  return items = collectXPath()
                case 'XSLT 1': return items = collectXSLT1();     
                case 'XSLT 2': return items = collectXSLT2();   
                case 'XQuery':       
            }
            
            function collectXSLT2()
            {
                console.log('1');
                
                var xmlPath = path.resolve(__dirname, '../saxon/xmlPath.xml');
                fs.writeFileSync(xmlPath, document.Text, 'utf8');
                console.log('2');
                var xslPath = path.resolve(__dirname, '../saxon/xslPath.xsl');
                fs.writeFileSync(xslPath, value, 'utf8');
                console.log('3');
                // Create a readable stream.
                /*var xmlStream = new Readable;
                xmlStream.push(document.Text);
                xmlStream.push(null);
                console.log('4');
                var xslStream = new Readable;
                xslStream.push(value);
                xslStream.push(null);
                console.log('5');*/
 
                console.log('6');
                var readerStream = fs.createReadStream(xmlPath).pipe(saxon.xslt(xslPath));
                var data = ''
                var once = false;
                console.log('7');
                
                readerStream.on('data', (chunk) =>
                {
                    data += chunk;
                });
                
                readerStream.on('end', () =>
                {
                    if (once) return;
                    once = true;
                    return data;
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
                
                return xslt4node.transformSync(config);
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

                return xml.toString();
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
                
                return xml.toString();
            } 
        }       
            
        // Check the given items against a rule.
        function performCheck(items)
        {
            var checkType = xpath.select("//check/@type", ruleDom)[0].value;
            var checkValue = xpath.select("//check/text()", ruleDom).toString();
            console.log('checkType = ' + checkType);
            console.log('checkValue = ' + checkValue);
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
        
        return { 'document' : document.Name, 'name' : name, 'description' : description, 'results' : results };
    }
    
    function prepareViewsData(data)
    {
        // Create Synthetical and Analytical View data.
        AnalyticalData = {'Results' : []};
        SyntheticalData = {'Results' : []};
        var document, rule, name, results, matches, failed, result;
        for (var i = 0; i < data.length; i++)
        {
            rule = data[i];
            document = rule['document'];
            name = rule['name'];
            results = rule['results'];
            matches = results.length;
            failed = 0;
            for (var j = 0; j < matches; j++)
            {
                if (!results[j]['valid'])
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
    self.fireRules = function(rules)
    {
        console.log('Documents.length = ' + Documents.length);
        console.log('rules.length = ' + rules.length);
        // Perform validation against every document.
        for (var j = 0; j < Documents.length; j++)
        {
            // Perform validation for each rule.
            var results = [];
            for (var i = 0; i < rules.length; i++)
            {
                var rulePath = path.join(RulesDirectory, rules[i]);
                results.push(this.validate(rulePath, j));
            }
        }

        prepareViewsData(results);

        return results;
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
            // Extract the files.
            //fs.unlink(extractedFolder);
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
            var file = files[i];
            
            // Distinguish between DOCX and XML files.
            switch (file.Type)
            {
                // Case XML file.
                case 'application/xml':
                case 'text/xml':
                    documentString = fs.readFileSync(file.Path).toString();
                    break;
                // Case DOCX file.
                case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
                    // Read the document as base 64.
                    var fileString = fs.readFileSync(file.Path).toString('base64');
                    
                    // Open the document.
                    var doc = new openXml.OpenXmlPackage(fileString);
                    
                    // Extract the main part.
                    var mainPart = doc.mainDocumentPart();
                    
                    // Set the document as the DOCX main part.
                    documentString = mainPart.data;
                    break;
                default:
                    continue;
            }

            // Set the variable holding the document.
            Documents.push({ Name : file.Name, Text : documentString, DOM : new dom().parseFromString(documentString)});
            
            // Destroy the temporary file.
            fs.unlink(file.Path);
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
            
            return [rulePath, name, description];
        }
    }
};

module.exports = DocValidator;