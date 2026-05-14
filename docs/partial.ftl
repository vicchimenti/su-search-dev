<#ftl encoding="utf-8" output_format="HTML" />
<#--
/**
 * @template partial.ftl
 * @description Main search results template for Funnelback integration
 * 
 * This file is responsible for determining the overall structure
 * of the search implementation without the header. Unlike simple.ftl,
 * it only provides the search-specific elements and does not include things
 * like CSS or headers and footers.
 * 
 * Components included:
 * - The HTML for the overall structure of the main content
 * - Third party libraries
 * - References to JavaScript templates for sessions and concierge
 * 
 * The intended purpose of this template is to allow for partial integration
 * into a Content Management System (CMS).
 * 
 * @version 5.0.1
 * @author Victor Chimenti
 * @lastModified 2025-03-13
 */
-->

<#-- Core Funnelback imports -->
<#import "/web/templates/modernui/funnelback_classic.ftl" as s/>
<#import "/web/templates/modernui/funnelback.ftl" as fb />

<#-- 
/**
 * Global Stencils imports
 * 
 * The namespace will be available in all templates which are imported.
 * Each import provides specific functionality for the search interface.
 */
-->
<#import "base.ftl" as base />
<#import "hero_banner.ftl" as hero_banner />
<#import "search_tools.ftl" as search_tools />
<#import "counts.ftl" as counts />
<#import "query_blending.ftl" as query_blending />
<#import "spelling_suggestions.ftl" as spelling_suggestions />
<#import "curator.ftl" as curator />
<#import "tabs.ftl" as tabs />
<#import "facets.breadcrumbs.ftl" as facets_breadcrumbs />
<#import "facets.ftl" as facets />
<#import "tier_bars.ftl" as tier_bars />
<#import "pagination.ftl" as pagination />
<#import "a-z_listing.ftl" as az_listing />
<#import "contextual_navigation.ftl" as contextual_navigation />
<#import "auto_complete.ftl" as auto_complete />
<#import "auto_complete.concierge.ftl" as concierge />
<#import "curator.ftl" as curator />
<#import "result_list.ftl" as result_list />
<#import "no_results.ftl" as no_results />
<#import "extra_search.ftl" as extra_search />
<#import "results.ftl" as results />
<#import "client_includes.ftl" as client_includes />
<#import "sessions.ftl" as sessions />

<#-- 
/**
 * Specific result styling imports
 * 
 * These imports are required for the automatic template selection to work.
 * The various namespaces (e.g. 'video', 'facebook') need to be on the main scope.
 * Each import handles rendering for a specific content type.
 */
-->
<#import "results.news.ftl" as news />
<#import "results.law.ftl" as law />
<#import "results.programs.ftl" as programs />
<#import "results.people.ftl" as people />
<#import "results.video.ftl" as video />
<#import "results.facebook.ftl" as facebook />
<#import "results.events.ftl" as events />
<#import "results.twitter.ftl" as twitter />
<#import "results.instagram.ftl" as instagram />

<#-- Used to send absolute URLs for resources -->
<#assign httpHost=httpRequest.getHeader('host')!"">

<#-- 
/**
 * SVG Icon Import
 * 
 * Import SVG icons so they are available using the <use> directive throughout the template.
 * Icons are hidden but accessible to the DOM.
 */
-->
<div style="display:none">
    <#include "utilities.icons.ftl" />
</div>

<#-- 
/**
 * Main Content Structure
 * 
 * Defines the primary search interface layout with:
 * - Search form
 * - Tab navigation
 * - Two-column layout (facets sidebar + results)
 */
-->
<div class="stencils__main higher-education">      
    <@hero_banner.SearchForm />
    <@tabs.Tabs />
    <div class="grid-container">
        <div class="funnelback-search no-wysiwyg grid-x grid-padding-x">          
            <#-- 
            /**
             * Left Sidebar / Facets Column
             * 
             * Contains:
             * - Promotional content section
             * - Faceted navigation
             * - Left-positioned curator content
             */
            -->
            <div class="funnelback-search__side initial-12 medium-4 cell" id="funnelbach-search-facets">
                <#-- 
                /**
                 * Promotional Section
                 * 
                 * Displays contextual promotional content based on the selected tab.
                 * Each tab has custom heading, text, link URL and button text.
                 */
                -->
                <section class="promo-section global-padding--3x oho-animate-sequence">
                    <article class="bg--dark bg--red global-padding--3x oho-animate fade-in-up">
                        <div class="grid-container">
                            <div class="grid-x grid-margin-x">
                                <div class="cell auto">
                                    <div class="promo-section--text text-margin-reset">
                                        <#-- Define CTA based on selected tab -->
                                        <#assign selectedTab = (response.customData.stencils.tabs.selected)!"">
                                        <#assign ctaHeading = "Visit our Campus" />
                                        <#assign ctaText = "Explore Seattle University, a vibrant campus just steps from downtown and the waterfront." />
                                        <#assign ctaLink = "/visit" />
                                        <#assign ctaButton = "Schedule a Tour" />

                                        <#if selectedTab == "Programs">
                                            <#assign ctaHeading = "Discover Programs" />
                                            <#assign ctaText = "Explore our academic programs and find the right fit for you!" />
                                            <#assign ctaLink = "/academics/all-programs" />
                                            <#assign ctaButton = "Browse Programs" />
                                        <#elseif selectedTab == "Faculty & Staff">
                                            <#assign ctaHeading = "Redhawk Hub" />
                                            <#assign ctaText = "View resources for Seattle University faculty, staff and current students." />
                                            <#assign ctaLink = "https://redhawks.sharepoint.com/sites/Intranet-Home" />
                                            <#assign ctaButton = "Explore Resources" />
                                        <#elseif selectedTab == "News">
                                            <#assign ctaHeading = "Latest Updates" />
                                            <#assign ctaText = "Stay up-to-date with the latest news and research." />
                                            <#assign ctaLink = "/newsroom" />
                                            <#assign ctaButton = "The Newsroom" />
                                        </#if>
                                        
                                        <h2 class="h4">${ctaHeading}</h2>
                                        <div class="global-spacing--2x">
                                            <p>${ctaText}</p>
                                        </div>
                                        <div class="global-spacing--4x">
                                            <a href="${ctaLink}" class="btn" target="_blank">${ctaButton}</a>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </article>
                </section>

                <#-- 
                /**
                 * Faceted Navigation
                 * 
                 * Displays facets specific to the currently selected tab.
                 * Facet configuration is pulled from the profile settings.
                 */
                -->
                <#assign tabFacets = question.getCurrentProfileConfig().get("stencils.tabs.facets.${(response.customData.stencils.tabs.selected)!}")!>

                <@facets.HasFacets facets=tabFacets>
                    <@facets.Facets 
                        facets=tabFacets 
                        maxCategories=question.getCurrentProfileConfig().get("stencils.faceted_navigation.max_displayed_categories")!
                    />
                </@facets.HasFacets>

                <#-- Left-positioned curator content (if available) -->
                <@curator.HasCuratorOrBestBet position="left">
                    <@curator.Curator position="left" />
                </@curator.HasCuratorOrBestBet>
            </div>

            <#-- 
            /**
             * Main Content / Results Column
             * 
             * Contains:
             * - Search tools (sort, results per page)
             * - Query modification feedback
             * - Spelling suggestions
             * - Facet breadcrumb trail
             * - Search results
             * - Pagination
             * - Contextual navigation
             */
            -->
            <div class="funnelback-search__body initial-12 medium-8 clearfix cell" id="funnelbach-search-body">
                <h2 class="funnelback-search__title sr-only">Results</h2>
                
                <@search_tools.SearchTools />
                
                <@query_blending.QueryBlending />
                <@spelling_suggestions.SpellingSuggestions />
                <@facets_breadcrumbs.Breadcrumb />

                <#-- Only display results after search has been performed -->
                <@s.AfterSearchOnly>                        
                    <@curator.HasCuratorOrBestBet position="top">
                        <@curator.Curator position="top" />
                    </@curator.HasCuratorOrBestBet>

                    <@no_results.NoResults />
                    <@result_list.ResultList />

                    <@curator.HasCuratorOrBestBet position="bottom">
                        <@curator.Curator position="bottom" />
                    </@curator.HasCuratorOrBestBet>

                </@s.AfterSearchOnly>

                <@pagination.Pagination />
                <@contextual_navigation.ContextualNavigation />
            </div>
        </div>
    </div>
</div>

<#-- 
/**
 * Required JavaScript Resources
 * 
 * Libraries required by the design developed by the Stencils cutup team.
 * Avoid changing these if possible to maintain proper functionality.
 */
-->
<script type="text/javascript" src="https://${httpHost!}/s/resources/${question.collection.id}/${question.profile}/themes/stencils/js/main.js"></script>