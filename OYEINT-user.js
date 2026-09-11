// ==UserScript==
// @name         Open YouTube Embeds In New Tab
// @namespace    https://github.com/equmaq/Open-YouTube-Embeds-In-New-Tab
// @version      1.2
// @description  Turns YouTube embeds into direct links opening in a new tab.
// @author       equmaq
// @license      GPL-2.0
//
// @match        *://*/*
// @run-at       document-start
// @grant        none
//
// @homepageURL  https://github.com/equmaq/Open-YouTube-Embeds-In-New-Tab
// @homepageURL  https://greasyfork.org/en/scripts/595398-open-youtube-embeds-in-new-tab
// @supportURL   https://github.com/equmaq/Open-YouTube-Embeds-In-New-Tab/issues
// @updateURL    https://raw.githubusercontent.com/equmaq/Open-YouTube-Embeds-In-New-Tab/refs/heads/main/OYEINT-user.js
// @downloadURL  https://raw.githubusercontent.com/equmaq/Open-YouTube-Embeds-In-New-Tab/refs/heads/main/OYEINT-user.js
// ==/UserScript==

(function () {
    'use strict';

    /**
     * Recursively traverses open Shadow Roots and standard DOM elements
     */
    function querySelectorAllShadow(selector, root = document) {
        let results = Array.from(root.querySelectorAll(selector));

        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);
        let node = walker.nextNode();

        while (node) {
            if (node.shadowRoot) {
                results = results.concat(querySelectorAllShadow(selector, node.shadowRoot));
            }
            node = walker.nextNode();
        }

        return results;
    }

    /**
     * Extract Video ID
     */
    function extractVideoId(node) {
        // Direct attribute checks
        const possibleAttrs = ['videoid', 'data-videoid', 'video-id', 'provider-video-id'];
        for (const attr of possibleAttrs) {
            if (node.hasAttribute && node.hasAttribute(attr)) {
                return node.getAttribute(attr);
            }
        }

        // Check src / href / url attributes on element or ancestors
        const sources = [
            node.src,
            node.getAttribute?.('src'),
            node.getAttribute?.('data-src'),
            node.getAttribute?.('href'),
            node.getAttribute?.('url'),
            node.getAttribute?.('data-url'),
            node.getAttribute?.('permalink')
        ];

        for (const src of sources) {
            if (src && typeof src === 'string') {
                const match = src.match(/(?:embed\/|v\/|watch\?v=|youtu\.be\/|vi\/)([a-zA-Z0-9_-]{11})/);
                if (match && match[1]) {
                    return match[1];
                }
            }
        }

        return null;
    }

    /**
     * Intercept clicks on an element and force new tab redirect
     */
    function attachRedirectHandler(element, watchUrl) {
        if (element.dataset.ytRedirectBound) return;
        element.dataset.ytRedirectBound = 'true';

        element.style.cursor = 'pointer';

        // Capture event phase prevents Reddit's native media player scripts from triggering
        element.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            window.open(watchUrl, '_blank', 'noopener,noreferrer');
            return false;
        }, true);
    }

    /**
     * Process <lite-youtube> components
     */
    function processLiteYouTube(liteEl) {
        if (liteEl.dataset.ytRedirectProcessed) return;
        const videoId = extractVideoId(liteEl);
        if (!videoId) return;

        const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
        liteEl.dataset.ytRedirectProcessed = 'true';

        attachRedirectHandler(liteEl, watchUrl);

        const playBtn = liteEl.querySelector('button.lyt-playbtn, button.lty-playbtn, .lty-playbtn, .lyt-playbtn');
        if (playBtn) {
            playBtn.setAttribute('title', 'Open video in new tab');
            if (playBtn.tagName.toLowerCase() === 'button') {
                const aLink = document.createElement('a');
                aLink.href = watchUrl;
                aLink.target = '_blank';
                aLink.rel = 'noopener noreferrer';
                aLink.className = playBtn.className;
                aLink.innerHTML = playBtn.innerHTML;
                playBtn.parentNode.replaceChild(aLink, playBtn);
            }
        }
    }

    /**
     * Process Reddit specific video elements (shreddit-embed, shreddit-player, reddit iframe containers)
     */
    function processRedditEmbeds(root) {
        // Reddit web components and containers
        const redditEmbeds = querySelectorAllShadow('shreddit-embed[provider="youtube"], shreddit-player[provider="youtube"], [data-provider="youtube"]', root);

        redditEmbeds.forEach((embed) => {
            if (embed.dataset.ytRedirectProcessed) return;

            const videoId = extractVideoId(embed) || extractVideoId(embed.querySelector('a, iframe'));
            if (!videoId) return;

            const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
            embed.dataset.ytRedirectProcessed = 'true';

            attachRedirectHandler(embed, watchUrl);
        });
    }

    /**
     * Process standard <iframe> YouTube embeds
     */
    function processIframeEmbed(iframe) {
        if (iframe.dataset.ytRedirectProcessed) return;

        const videoId = extractVideoId(iframe);
        if (!videoId) return;

        iframe.dataset.ytRedirectProcessed = 'true';
        const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;

        const container = document.createElement('div');
        container.className = 'yt-embed-redirect-wrapper';
        container.style.cssText = `
            position: relative;
            display: inline-block;
            width: ${iframe.offsetWidth || 560}px;
            height: ${iframe.offsetHeight || 315}px;
            max-width: 100%;
            background-color: #000;
            background-image: url("https://i.ytimg.com/vi/${videoId}/hqdefault.jpg");
            background-size: cover;
            background-position: center;
            overflow: hidden;
            cursor: pointer;
        `;

        const link = document.createElement('a');
        link.href = watchUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.title = 'Open YouTube Video in New Tab';
        link.style.cssText = `
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            text-decoration: none;
        `;

        link.innerHTML = `
            <svg height="68" viewBox="0 0 68 48" width="68">
                <path d="M66.52,7.74c-0.78-2.93-2.49-5.41-5.42-6.19C55.79,.13,34,0,34,0S12.21,.13,6.9,1.55 C3.97,2.33,2.27,4.81,1.48,7.74C0.06,13.05,0,24,0,24s0.06,10.95,1.48,16.26c0.78,2.93,2.49,5.41,5.42,6.19 C12.21,47.87,34,48,34,48s21.79-.13,27.1-1.55c2.93-.78,4.64-3.26,5.42-6.19C67.94,34.95,68,24,68,24S67.94,13.05,66.52,7.74z" fill="#212121" fill-opacity="0.8"></path>
                <path d="M 45,24 27,14 27,34" fill="#fff"></path>
            </svg>
        `;

        container.appendChild(link);

        if (iframe.parentNode) {
            iframe.parentNode.replaceChild(container, iframe);
        }
    }

    /**
     * Master scanner scanning document root and shadow subtrees
     */
    function scanAndProcess() {
        // Lite-youtube
        const liteNodes = querySelectorAllShadow('lite-youtube, lite-youtube-embed');
        liteNodes.forEach(processLiteYouTube);

        // Standard YouTube Iframes
        const iframes = querySelectorAllShadow('iframe[src*="youtube.com/embed"], iframe[src*="youtube-nocookie.com/embed"]');
        iframes.forEach(processIframeEmbed);

        // Reddit Custom Web Components
        processRedditEmbeds(document);
    }

    // Run initial scan on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', scanAndProcess);
    } else {
        scanAndProcess();
    }

    // Continuous check targeting dynamically hydrated DOMs & Infinite Scroll on SPAs
    setInterval(scanAndProcess, 1000);

    // Mutation Observer with deep shadow DOM traversal support
    const observer = new MutationObserver(() => scanAndProcess());
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

})();
