// Libraries.
var express = require('express');
var fs = require('fs');
var dataurl = require('dataurl');
var docxtemplater = require('docxtemplater');
var path = require('path');

var DocumentValidator = require("../models/Document-Validator.js");

// Global variables
var router = express.Router();
var validator = new DocumentValidator();  
var uploadsDir = 'public/uploads/';
var rulesDir = path.resolve(__dirname, '../xml/rule-sets');

// Home page.
router.get('/', function(req, res)
{
    res.render('index');
});

// Return all directories within a given path.
function getDirectories(srcpath)
{
    return fs.readdirSync(srcpath).filter(function(file)
    {
        return fs.statSync(path.join(srcpath, file)).isDirectory();
    });
}

// GET method for obtaining the list of all available Rule Sets.
router.get('/getRules', function(req, res)
{
    res.send(validator.GetRules());
});

// POST method for validating the document according to a selected list of rules.
router.post('/validation', function(req, res, next)
{
    var answers = validator.fireRules(req.body.Rules);
    res.send(answers);
});

// POST method for uploading the file.
router.post('/upload', function(req, res, next)
{
    var dataObj = dataurl.parse(req.body.DocData);
    var fileName = req.body.DocName;
    var type = req.body.DocType;
    var filepath = path.join(uploadsDir, fileName);

    if (dataObj) 
        fs.writeFile(filepath, dataObj.data, function(err)
        {
            if (err)
                next(err);
            else
                res.send(validator.SetDocument(fileName, type));
        });
    else 
        next({ error: 'Unable to read data.' });
});

// HTTP Get request to generate the Synthetical View.
router.get('/downloadSyntheticalView', function(req, res)
{
    var filePath = validator.DownloadSyntheticalView();
    res.setHeader('Content-type', "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.download(filePath);
});

// HTTP Get request to generate the Synthetical View.
router.get('/downloadAnalyticalView', function(req, res)
{
    var filePath = validator.DownloadAnalyticalView();
    res.setHeader('Content-type', "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.download(filePath);
});

module.exports = router;