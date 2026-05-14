<#ftl encoding="utf-8" output_format="HTML" />
<#-- 
  This template contains markup and logic related to the 
  curator feature.
-->

<#--
    Display Curator messages.

    @param position Position attribute to consider from the Curator message.
        Only messages with a position attribute matching this will be displayed. Can be empty to display all messages regardless of position.
-->
<#macro Curator position sectionCss="">
    <!-- curator::Curator -->
    <section class="curator ${sectionCss}"
        role="complementary"
        aria-labelledby="curator--${position!"top"}">
        <h2 id="curator--${position!"top"}" 
            class="sr-only">
            Curator - ${position!"top"}
        </h2>
        <article class="module-curator__list">
            <#list (response.curator.exhibits)![] as exhibit>
                <#if !position?? || ((exhibit.additionalProperties.position)!"top") == position>
                    <#if exhibit.messageHtml??>
                        <#-- Simple message -->
                        <blockquote class="blockquote search-exhibit ${(exhibit.additionalProperties.class)!} mb-3 p-1">
                            ${exhibit.messageHtml?no_esc}
                        </blockquote>
                    <#elseif exhibit.descriptionHtml??>                        
                        <article class="listing-item listing-item--promoted listing-item--background-grey10 listing-item--color-black" ${(exhibit.additionalProperties.class)!}">
                            <#-- Display the image if there is one -->
                            <#if (exhibit.additionalProperties.image)!?has_content>
                                <div class="listing-item__image-wrapper">                                    
                                        <#-- TODO - Change the URL to reference one from the curator rule -->
                                        <img class="listing-item__image" src="${(exhibit.additionalProperties.image)!}" alt="">
                                </div>
                            </#if>
                            <div class="listing-item__content">
                                <div class="listing-item__header">
                                    <span class="listing-item__promoted-tag">promoted</span>
                                    <h3 class="module-curator__title h4 funderline">
                                        <a 
                                            href="${exhibit.linkUrl!}"
                                            class="listing-item__title-link"
                                            title="${exhibit.titleHtml!}" 
                                            target="_blank"
                                        >
                                            ${exhibit.titleHtml!}
                                        </a>
                                    </h3>
                                    
                                </div>                                    
                                <div class="listing-item__body">
                                    <#-- Output the description -->
                                    <#if exhibit.descriptionHtml??>
                                        <div class="listing-item__summary">
                                            ${exhibit.descriptionHtml?no_esc}
                                        </div>
                                    </#if>                            

                                    <#-- Call to Action (CTA) -->                        
                                    <#-- Output and option explicit the call to action link -->
                                    <#if (exhibit.additionalProperties.call_to_action_url)!?has_content>
                                        <a class="listing-item__action" href="${(exhibit.additionalProperties.call_to_action_url)!}">
                                            ${(exhibit.additionalProperties.call_to_action_label)!}
                                        </a>
                                    </#if>
                                </div>
                            </div>
                        </article>
                    </#if>
                </#if>
            </#list>
        </article>
    </section>
</#macro>

<#-- 
    Runs the nested code if there is at least 1 curator rule (which includes the best bet type) which 
    matches the position.
-->
<#macro HasCuratorOrBestBet position>
    <#if ((response.curator.exhibits)![])?filter(exhibit -> (!position?? || ((exhibit.additionalProperties.position)!"top") == position))?size gt 0>
        <#nested>
    </#if>
</#macro>

<#-- 
    Runs the nested code if there is at least 1 curator rule which 
    matches the position.
-->
<#macro HasCurator position>
    <#if ((response.curator.exhibits)![])?filter(exhibit -> exhibit.category != "BEST_BETS" && (!position?? || ((exhibit.additionalProperties.position)!"top") == position))?size gt 0>
        <#nested>
    </#if>
</#macro>

<#-- 
    Runs the nested code if there is at least 1 best bet rule.
-->
<#macro HasBestBets>
    <#if ((response.curator.exhibits)![])?filter(exhibit -> exhibit.category == "BEST_BETS")?size gt 0>
        <#nested>
    </#if>
</#macro>