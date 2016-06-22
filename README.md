# Validation Engine

Validation Engine is a rule-based online tool for validating documents.

The documents must have the following format: XML; DOCX; ZIP containing XML or DOCX.

The rules are expressed via XML and are of two types, namely:
- Collect-And-Check
- Collect-And-Compare

The rules may cantain XPath, XQuery, XSLT and Regex.


### UML Class diagram

![alt text](https://github.com/tomOgn/ValidationEngine/blob/master/use-case-validator.png)

### Installation
To build and run the project locally you need to perform the following actions:
  - npm install
  - bower install
  - mongod
  - node bin/www
  - http://localhost:3000/

### Technological Stack
The Validation Engine uses a number of open source projects:

* [MongoDB]
* [node.js]
* [Express]
* [Passport.js]
* [jQuery]

 
   [node.js]: <http://nodejs.org>
   [jQuery]: <http://jquery.com>
   [express]: <http://expressjs.com>
   [Passport.js]: <http://passportjs.org> 
   [MongoDB]: <https://www.mongodb.com>
