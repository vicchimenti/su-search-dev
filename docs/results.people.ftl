<#ftl encoding="utf-8" output_format="HTML" />

<#-- 
    Macro decides how each result should be presented. 

    @param result An individual result fron the data model
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
    Stardard view of a result which is to be displayed in the 
    main section of the search engine result page (SERP)
    @param result An individual result fron the data model
-->
<#macro ListView result>
    <@GenericView result=result />
</#macro>

<#--
    Card view of a result which is to be displayed in the 
    main section of the search engine result page (SERP)
    @param result An individual result fron the data model
-->
<#macro CardView result>
    <@GenericView result=result />
</#macro>

<#--
    A generic view used to drive both the the list and card view
    @param result An individual result fron the data model
-->
<#macro GenericView result>
    <!--results.people::GenericView -->
    <article class="listing-item listing-item--people listing-item--background-grey10 listing-item--color-black dataListing peopleData" data-fb-result="${(result.indexUrl)!}"> 
        
        <#if (result.listMetadata["image"]?first)!?has_content>
            <div class="listing-item__image-wrapper">
                <img class="deferred listing-item__image" alt="Thumbnail for ${result.title!}" src="${(result.listMetadata["image"]?first)!}" data-deferred-src="${(result.listMetadata["image"]?first)!}"> 
            </div>  
        <#elseif ((question.getCurrentProfileConfig().get("stencils.showcase"))!"FALSE")?upper_case == "TRUE">
            <div class="listing-item__image-wrapper"></div>
        </#if>
        <div class="listing-item__content">
            <#-- Title -->
            <#if (result.title)!?has_content>
                <div class="listing-item__header">

                    <h3 class="listing-item__title h4 funderline">
                        <a 
                        href="${result.clickTrackingUrl!}" 
                        data-live-url="${result.liveUrl}" 
                        title="${(result.listMetadata["peopleFirstName"]?first)!} ${(result.listMetadata["peopleLastName"]?first)!}"
                        class="listing-item__title-link"
                        target="_blank"
                    >
                            <@s.Truncate length=90>
                                ${(result.listMetadata["t"]?first)!}
                            </@s.Truncate>
                        </a>    
                    </h3>


                    <#--  Subtitle -->
                    <#if (result.listMetadata["peoplePosition"]?first)!?has_content>
                        <div class="listing-item__subtitle">
                            <#if (result.listMetadata["peoplePosition"]?first)!?has_content>
                                <p class="listing-item__subtitle">
                                  ${(result.listMetadata["peoplePosition"]?first)!}<br>${(result.listMetadata["peopleDepartment"]?first)!}
                                </p>
                            </#if>
                        </div>
                    </#if>
                </div>
            </#if>
            
            
            <#-- Body -->
            <div class="listing-item__body">
                <#--  <#if (result.listMetadata["c"])!?has_content>
                    <div class="listing-item__summary">
                        <@s.boldicize>
                            ${result.listMetadata["c"]?first}
                        </@s.boldicize>
                    </div>
                </#if>    -->


                <#-- Metadata should as tags/pills -->        
                <#if (result.listMetadata["expertiseArea"])!?has_content>
                    <span class="listing-item__subtitle"><strong>Areas of Expertise:</strong></span>
                    <ul aria-label="Result tags" class="listing-item__tags">
                        <#list result.listMetadata["expertiseArea"] as expertiseArea>
                            <li class="listing-item__tag">${expertiseArea}</li>
                        </#list>
                    </ul>
                </#if>
            </div>          

            <#-- Display the time which this result has last been visited by the user -->
            <@sessions.LastVisitedLink result=result/> 

            <#-- Footer -->                    
            <div class="listing-item__footer">
                <div class="listing-item__footer-block listing-item__footer-block">
                    <#if (result.listMetadata["affiliation"])!?has_content && (result.listMetadata["college"])!?has_content>
                        <p>
                            ${(result.listMetadata["affiliation"]?first)!} | ${(result.listMetadata["college"]?first)!}
                        </p>
                    <#elseif (result.listMetadata["affiliation"])!?has_content>
                        <p>
                            ${(result.listMetadata["affiliation"]?first)!}
                        </p>
                    </#if>
                </div>
            </div>
        </div>
    </article>    
</#macro>
