<xsl:stylesheet version="1.0" 
	xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
	xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
	xmlns:v="urn:schemas-microsoft-com:vml"
	exclude-result-prefixes="xsl w v">

	<xsl:output method="xml" indent="yes" omit-xml-declaration="yes"/>
	
	<xsl:template match="/">
	<items>
		<xsl:for-each select="//w:p[w:r/w:pict]">
		<item>
	 		<xsl:attribute name="i">
	 			<xsl:value-of select="position()"/>
			</xsl:attribute>
			<xsl:apply-templates select="./following-sibling::w:p[1]//w:t"/>
		</item>
		</xsl:for-each>
	</items>
	</xsl:template>
	<xsl:template match="w:t">
		<xsl:value-of select="."/>
	</xsl:template>
</xsl:stylesheet>