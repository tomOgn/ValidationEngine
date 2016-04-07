var DocValidator = function()
{  
    var self = this;
    
    // External libraries
    var xslt4node = require('xslt4node');
    var XRegExp = require('xregexp');
    var fs = require('fs');
    var vm = require('vm');
    var path = require('path');
    var xpath = require('xpath');
    var dom = require('xmldom').DOMParser;
    var XMLSerializer = require('xmldom').XMLSerializer;
    
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
    var serializer = new XMLSerializer();
    var docDOM, Document;
    var uploadsDirectory = path.resolve(__dirname, '../public/uploads');
    var RulesDirectory = path.resolve(__dirname, '../xml/rules');
    
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
        `var libxml = require("libxmljs");
        var xsd = '<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"><xs:element name="comment"><xs:complexType><xs:all><xs:element name="author" type="xs:string"/><xs:element name="content" type="xs:string"/></xs:all></xs:complexType></xs:element></xs:schema>';
        var xml_valid = '<?xml version="1.0"?><comment><author>author</author><content>nothing</content></comment>';
        var xml_invalid = '<?xml version="1.0"?><comment>A comment</comment>';

        var xsdDoc = libxml.parseXml(xsd);
        var xmlDocValid = libxml.parseXml(xml_valid);
        var xmlDocInvalid = libxml.parseXml(xml_invalid);

        console.log(xmlDocValid.validate(xsdDoc));
        console.log(xmlDocInvalid.validate(xsdDoc));`

        return true; // TODO
    }

    // Validate the document against a set of rules.
    self.validate = function(rulePath)
    {
        // Parse the XML file.
        var ruleString = fs.readFileSync(rulePath).toString();
        var ruleDom = new dom().parseFromString(ruleString);
        var children = ruleDom.documentElement.childNodes;
        var collect = {}
        var check = {};
        var description = xpath.select("//description/text()", ruleDom).toString();
        var name = xpath.select("//name/text()", ruleDom).toString();
        var type = xpath.select("/rule/@type", ruleDom)[0].value;
        collect['type'] = xpath.select("//collect/@type", ruleDom)[0].value;
        collect['value'] = xpath.select("//collect/*", ruleDom).toString();
        check['type'] = xpath.select("//check/@type", ruleDom)[0].value;
        check['value'] = xpath.select("//check/*", ruleDom).toString();
        console.log(type);
        console.log(name);
        console.log(check['value']);
        console.log(collect['value']);    
        var result;       
        // Fire the rule.
        if (collect['type'] == 'XSLT 1')
        {
            var xslString = collect['value'];
            var config =
            {
                xslt: xslString,
                source: Document,
                result: String,
                props: { indent: 'yes' }
            };
            result = xslt4node.transformSync(config);
            
            
        }
        
        return verifyResult(result);
        
        // Verify the results for a particular Rule Set and update the validation log.
        function verifyResult(result)
        {
            // Get the items.
            var resultDom = new dom().parseFromString(result);
            var children = resultDom.firstChild.childNodes;
            var items = [];
            for (var i = 0; i < children.length; i++)
            {
                var child = children[i];
                if (child.nodeName == 'item')
                {
                    var item = {};
                    item["i"] = (child.attributes)? child.attributes[0].nodeValue : "";
                    item["value"] = (child.firstChild)? child.firstChild.nodeValue : "";
                    items.push(item);
                }
            }
            
            // Validate the items against the regular expression.
            var rule = XRegExp(check['value']);
            for (var i = 0; i < items.length; i++)
                items[i]["valid"] = rule.test(items[i]["value"]);

            return { 'rule' : description, 'results' : items };
        }
    }
    
    // Validate the document against the selected rules.
    self.fireRules = function(rules)
    {
        // Perform validation for each Rule Set directory.
        var results = [];
        console.log(rules.length);
        for (var i = 0; i < rules.length; i++)
        {
            var rulePath = path.join(RulesDirectory, rules[i]);
            console.log(rulePath);
            var log = this.validate(rulePath);
            results.push({ 'Rule' : rules[i], 'Log' : log });
        }

        return results;
    }
    
    // Set the document to validate.
    self.SetDocument = function(fileName, type)
    {console.log('1');
        // Construct the absolute path.
        fileName = "" + fileName;
        var filePath = path.join(uploadsDirectory, fileName);
        
        // Read the file.
        var fileString = fs.readFileSync(filePath).toString('base64');
 
        // Set the DOM Parser.
        Ltxml.DOMParser = dom;
        
        var documentString;
        
        // Distinguish between DOCX, RAR, ZIP and XML files.
        switch (type)
        {
            // Case XML file.
            case 'application/xml':
            case 'text/xml':
                
            break;
            // Case DOCX file.
            case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':

            break;
            // Case ZIP or RAR file.        
            case 'application/x-rar-compressed, application/octet-stream':
            case 'application/zip, application/octet-stream':
            
            break;      
        }
        if (type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        {
            // Open the document.
            var doc = new openXml.OpenXmlPackage(fileString);
            
            // Extract the main part.
            var mainPart = doc.mainDocumentPart();
            
            // Set the document as the DOCX main part.
            documentString = mainPart.data;
        }
        else
        {
            documentString = fileString;
        }
        
        // Set the variable holding the document.
        Document = documentString;
        
        // Set the variable holding the document DOM.
        docDOM = new dom().parseFromString(documentString);
        console.log('ciao');
        return true;
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
            console.log(target);
            return [rulePath, name, description];
        }
    }
};

module.exports = DocValidator;