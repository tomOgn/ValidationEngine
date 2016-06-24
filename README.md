# Validation Engine

Validation Engine is a rule-based online tool for validating documents. 

The documents must have the following format: XML; DOCX; ZIP containing XML or DOCX.

The User Management is intended to be separated and not public, an example is here: https://github.com/tomOgn/ValidationEngineUserManagement.
### Rules

The rules are expressed via XML and are of two types, namely:
- Collect-And-Check
- Collect-And-Compare

#### Collect-And-Check
With Collect-And-Check you can collect a list of elements from the document and check their validity through a syntactical rule.

The \<collect\> part may be formed using:
- Regex: \<collect type=’Regex’\>, or
- XPath 1.0: \<collect type=’XPath 1’\>, or
- XSLT 1.0: \<collect type=’XSLT 1’\>, or
- XSLT 2.0: \<collect type=’XSLT 2’\>.

The \<check\> part may be formed using:
- Regex: \<check type=’Regex’\>, or
- XSLT 1.0: \<check type=’XSLT 1’\>, or
- XSLT 2.0: \<check type=’XSLT 2’\>.

#### Collect-And-Compare
With Collect-And-Compare you can collect two or more lists of items from the document and compare them via a syntactical rule.

The \<collect\> part may be formed using:
- XPath 1.0: \<collect type=’XPath 1’\>, or
- XSLT 1.0: \<collect type=’XSLT 1’\>, or
- XSLT 2.0: \<collect type=’XSLT 2’\>.

The \<compare\> part may be formed using:
- XSLT 1.0: \<collect type=’XSLT 1’\>, or
- XSLT 2.0: \<collect type=’XSLT 2’\>.

### UML Use Case diagram

![alt text](https://github.com/tomOgn/ValidationEngine/blob/master/use-case-validator.png)

### Technological Stack
The Validation Engine uses a number of open source projects:

* [MongoDB]
* [node.js]
* [Express]
* [Passport.js]
* [jQuery]

### Installation
To build and run the project locally you need to perform the following actions:
  - npm install
  - bower install
  - mongod
  - node bin/www
  - http://localhost:3000/
 
   [node.js]: <http://nodejs.org>
   [jQuery]: <http://jquery.com>
   [express]: <http://expressjs.com>
   [Passport.js]: <http://passportjs.org> 
   [MongoDB]: <https://www.mongodb.com>
