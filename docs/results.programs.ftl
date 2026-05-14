<#ftl encoding="utf-8" output_format="HTML" />

<#-- 
    Macro decides how each result should be presented. 

    @param result An individual result from the data model
    @param view An uppercase string which represents how
        the result should be displayed. Defaults to DETAILED.
-->
<#macro Result result=result view="LIST">
    <#switch view?upper_case>
        <#case "CARD">
            <@CardView result=result />
            <#break>
        <#case "LIST">
            <#-- Determine if results should be hidden or not -->
            <@ListView result=result />
            <#break>
        <#default>
            <@ListView result=result />
    </#switch>
</#macro>

<#--
    Standard view of a result which is to be displayed in the 
    main section of the search engine result page (SERP)
    @param result An individual result from the data model
-->
<#macro ListView result>
    <@GenericView result=result />
</#macro>

<#--
    Card view of a result which is to be displayed in the 
    main section of the search engine result page (SERP)
    @param result An individual result from the data model
-->
<#macro CardView result>
    <@GenericView result=result />
</#macro>

<#--
    A generic view used to drive both the the list and card view
    @param result An individual result from the data model
-->
<#macro GenericView result>
    <!-- results.programs::GenericView -->
    <article class="listing-item listing-item--program listing-item--background-grey10 listing-item--color-black dataListing programData" data-fb-result="${(result.indexUrl)!}">   

        <#if (result.listMetadata["programImage"]?first)!?has_content >
            <div class="listing-item__image-wrapper">
                <img class="deferred listing-item__image" alt="Thumbnail for ${result.title!}" src="//${httpRequest.getHeader('host')}/s/resources/${question.collection.id}/${question.profile}/img/pixel.gif" data-deferred-src="${(result.listMetadata["programImage"]?first)!}"> 
            </div>  
        </#if>
        <div class="listing-item__content">
            <#-- Title -->
            <#if (result.title)!?has_content>
                <div class="listing-item__header">
                    <h3 class="listing-item__title h4 funderline">
                        <a 
                        href="${result.clickTrackingUrl!}" 
                        data-live-url="${result.liveUrl}" 
                        title="${result.title!}" 
                        class="listing-item__title-link"
                        target="_blank"
                    >
                            <@s.Truncate length=90>
                                ${(result.listMetadata["t"]?first)!}
                            </@s.Truncate>
                        </a>    
                    </h3>
                    <#-- Subtitle -->
                    <#if (result.listMetadata["programFaculty"]?first)!?has_content>
                        <div class="listing-item__subtitle">
                            ${(result.listMetadata["programFaculty"]?first)!}     
                        </div>
                    </#if>
                </div>
            </#if>
            
            
            <#-- Body -->
            <div class="listing-item__body">
                <#-- Summary -->
                <div class="listing-item__summary">
                    <@s.boldicize><@s.Truncate length=200>
                      ${(result.listMetadata["c"]?first)!} 
                    </@s.Truncate></@s.boldicize>
                </div>
            </div>          

            <#-- Display the time which this result has last been visited by the user -->
            <@sessions.LastVisitedLink result=result/> 

            <#-- Footer -->
            <div class="listing-item__footer">
                <div class="listing-item__footer-block listing-item__footer-block">
                    <#if (result.title)!?has_content>
                        <p>
                            ${result.title!}
                        </p>
                    </#if>
                </div>
            </div>                     
        </div>
    </article>    
</#macro>
