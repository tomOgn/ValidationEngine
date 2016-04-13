<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet
    xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
    xmlns:xs="http://www.w3.org/2001/XMLSchema"
    exclude-result-prefixes="xs"
    version="2.0">
    <xsl:output method="xml" indent="yes" omit-xml-declaration="yes"/>
    <xsl:template match="/">
        <results>
            <!-- Every acronym in the document must be defined in the table of acronyms -->
            <xsl:for-each select="//items[@id='1']/item">
                <xsl:call-template name="document-to-table"/>
            </xsl:for-each>
            <!-- Every acronym within the table of acronyms must be used at least once in the document -->
            <xsl:for-each select="//items[@id='2']/item">
                <xsl:call-template name="table-to-document"/>
            </xsl:for-each>
        </results>
    </xsl:template>
    <xsl:template name="document-to-table">
        <item>
            <xsl:variable name="passed" select="//items[@id='2']/item = ." />
            <xsl:attribute name="passed">
                <xsl:value-of select="$passed"/>
            </xsl:attribute>
            <description>
            <xsl:choose> 
                <xsl:when test="$passed">The acronym is both in the document and in the table.</xsl:when>
                <xsl:otherwise>The acronym is only in the document.</xsl:otherwise>
            </xsl:choose>
            </description>
            <value><xsl:value-of select="."/></value>
        </item>
    </xsl:template>
    <xsl:template name="table-to-document">
        <xsl:if test="not(//items[@id='1']/item = .)">
            <item>
                <xsl:attribute name="passed">
                    <xsl:value-of select="false()"/>
                </xsl:attribute>
                <description>The acronym is only in the table.</description>
                <value><xsl:value-of select="."/></value>
            </item>
        </xsl:if>
    </xsl:template>
</xsl:stylesheet>