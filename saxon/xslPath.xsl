<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" exclude-result-prefixes="xsl xs w" version="2.0">
				    <xsl:output method="xml" indent="yes" omit-xml-declaration="yes"/>
				    <xsl:strip-space elements="*"/>
				    
				    <xsl:variable name="allAcronyms">
				        <xsl:for-each select="//w:t[not(ancestor::w:tbl[w:tr[1]//w:tc[1]//w:t='Acronimo' and w:tr[1]//w:tc[2]//w:t='Descrizione'])]">
				            <xsl:analyze-string select="." regex="([A-Z]{{2,}})">
				                <xsl:matching-substring>
				                    <xsl:value-of select="concat(regex-group(1), ' ')"/>
				                </xsl:matching-substring>
				            </xsl:analyze-string>
				        </xsl:for-each>
				    </xsl:variable>  
				    
				    <xsl:variable name="distinctAcronyms" select="distinct-values(tokenize(normalize-space($allAcronyms), ' '))"/>
				    
				    <xsl:template match="/">
				        <items id="2">
				            <xsl:for-each select="$distinctAcronyms">
				                <xsl:sort select="."/>
				                <item>
				                    <xsl:value-of select="."/>
				                </item>
				            </xsl:for-each>
				        </items>
				    </xsl:template>
				</xsl:stylesheet>