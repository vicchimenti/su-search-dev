<#-- 
    Generate the HTML for advanced features which control the search results such as 
    sorting and number of results to display
-->
<#macro SearchTools>
    <#-- search_tools::SearchTools-->
    <div class="stencils-summary-and-search-tools">
        <@counts.Counts /> 
        <form
            action="${question.getCurrentProfileConfig().get("ui.modern.search_link")}" 
            method="GET"
            class="search-tools form custom-form custom-form--bg-white custom-form--color-black"
            data-pnp-component="stencils-search-tools"
        >
        <input type="hidden" name="collection" value="${question.collection.id}">

            <@base.inputsForForms allowList= ["enc", "form", "scope", "lang", "profile", "userType", "displayMode", "query"] />

            <#list question.selectedCategoryValues?keys as facetKey>
                <#list question.selectedCategoryValues[facetKey] as value>
                    <input type="hidden" name="${facetKey}" value="${value}">
                </#list>
            </#list>

            <button type="submit" class="sr-only">
                Submit
            </button>
        </form>           
    </div>
</#macro>


<#-- Obtain the result mode from the CGI paramters; Valid values are LIST and CARD -->
<#function getDisplayMode question>
    <#-- Default the display mode to "list" -->
    <#assign displayMode = ""> 

    <#-- Get the mode that is currently configured -->
    <#if (question.inputParameters["displayMode"]?first)!?has_content>
        <#-- Get the value from the user's selection -->
        <#assign displayMode = question.inputParameters["displayMode"]?first!?upper_case>    
    <#elseif (question.getCurrentProfileConfig().get("stencils.results.display_mode."+ response.customData.stencils.tabs.selected))!?has_content>
        <#-- Get the value from the profile config to see if a default has been specified from tabs. -->
        <#assign displayMode = question.getCurrentProfileConfig().get("stencils.results.display_mode."+ response.customData.stencils.tabs.selected)!?upper_case>
    <#elseif (question.getCurrentProfileConfig().get("stencils.results.display_mode"))!?has_content>
        <#-- Get the value from profile config -->
        <#assign displayMode = question.getCurrentProfileConfig().get("stencils.results.display_mode")!?upper_case>
    <#else>
        <#-- Default -->
        <#assign displayMode = "LIST"> 
    </#if>

    <#return displayMode>
</#function>

<#--
    Runs the best code when the specified display mode is selected.
-->
<#macro IsDisplayMode mode="LIST">
    <#if getDisplayMode(question) == mode!?upper_case>
        <#nested> 
    </#if>
</#macro>
