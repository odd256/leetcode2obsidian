// ==UserScript==
// @name         LeetCode to Obsidian
// @namespace    http://tampermonkey.net/
// @version      2024-10-10
// @description  Save the current leetcode problem as new obsidian note.
// @author       odd
// @match        https://leetcode.com/problems/*
// @match        https://leetcode.cn/problems/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @require      https://unpkg.com/turndown/dist/turndown.js
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_notification
// @grant        GM_openInTab
// @run-at       context-menu
// @license      MIT
// ==/UserScript==

(function () {
    "use strict";
    const turndownService = new TurndownService();
  
    // Function to find and return the timer value
    function getTimerValue() {
      const containerElement = document.querySelector("#ide-top-btns");
      if (!containerElement) {
        console.log("Container element not found");
        return null;
      }
  
      const timerElement = containerElement.querySelector(
        ".select-none.pr-2.text-sm.text-text-secondary.dark\\:text-text-secondary"
      );
      if (!timerElement) {
        console.log("Timer element not found within the container");
        return null;
      }
  
      const timerValue = timerElement.textContent || timerElement.innerText;
      console.log("Current Timer Value:", timerValue);
      return timerValue;
    }
  
    // Function to extract the problem URL from the current page
    function extractProblemUrl(currentUrl) {
      if (currentUrl.startsWith("https://")) {
        return "https://" + currentUrl.slice(8).split("/").slice(0, 3).join("/");
      } else if (currentUrl.startsWith("http://")) {
        return "http://" + currentUrl.slice(7).split("/").slice(0, 3).join("/");
      }
      return currentUrl;
    }
  
    // Function to get the difficulty level
    function getDifficulty() {
      const difficultyElement = document.querySelector(
        '[class*="text-difficulty-"]'
      );
      if (!difficultyElement) {
        console.log("Difficulty element not found");
        return null;
      }
  
      const difficultyText =
        difficultyElement.textContent || difficultyElement.innerText;
      return difficultyText.toLowerCase();
    }
  
    // Function to get the text of the <a> element
    function getProblemName() {
      const fullPath = window.location.pathname;
      const matchedPath = fullPath.match(/\/problems\/[^\/]+/)[0];
      const linkElement = document.querySelector(`a[href*="${matchedPath}"]`);
      if (!linkElement) {
        console.log("Link element not found for href:", matchedPath);
        return null;
      }
  
      let linkText = linkElement.textContent || linkElement.innerText;
      linkText = linkText.replace(/\?/g, "");
      return linkText;
    }
  
    // HTML to Markdown Converter
    function getMarkdownFromHtml(element) {
      const htmlContent = element.innerHTML;
      return turndownService.turndown(htmlContent);
    }
  
    function formatCodeToMarkdown(code, language = "javascript") {
      let convertedCode = code.replace("\\[", "[").replace("\\]", "]");
      return `\`\`\`${language}\n${convertedCode}\n\`\`\``
        .replace(/^\s*[\r\n]+/gm, "")
        .trim();
    }
  
    // Function to get the bearer token
    function getOrPromptForKey(key, promptText) {
      let token = GM_getValue(key, null);
      if (!token) {
        token = prompt(promptText);
        if (token) {
          GM_setValue(key, token);
          GM_notification({
            title: "Input Saved",
            text: `Your input for ${key} has been saved.`,
            timeout: 5000,
          });
        }
      }
      return token;
    }
  
    // Function to save the problem to Obsidian
    async function saveToObsidian() {
      const token = getOrPromptForKey(
        "obsidian_web_api_key",
        "Please enter your Obsidian API key:"
      );
      const obsidianUrl = getOrPromptForKey(
        "obsidian_api_url",
        "Please enter the Obsidian HTTPS API URL"
      ).replace(/\/$/, "");
      const documentPath =
        getOrPromptForKey(
          "obsidian_file_path",
          "Please enter the Obsidian File Path"
        ) + `/${getProblemName()}.md`;
  
      if (token) {
        const content = generateContent();
        await createObsidianDocument(obsidianUrl, documentPath, content, token);
      } else {
        console.error("Bearer token is not available.");
      }
    }
  
    // Function to generate the content for the Obsidian document
    function generateContent() {
      const currentTime = new Date()
        .toISOString()
        .replace("T", " ")
        .split(".")[0];
      const difficultyValue = getDifficulty();
      const question = getMarkdownFromHtml(
        document.getElementsByClassName("elfjS")[0]
      );
      const tagsContainer = document.querySelector(
        ".mt-2.flex.flex-wrap.gap-1.pl-7"
      );
      const tagList = Array.from(tagsContainer.children).map(
        (child) => child.innerHTML
      );
      const tags = `tags:\n${tagList.map((tag) => `  - ${tag}`).join("\n")}`;
      const code = getMarkdownFromHtml(
        document.getElementsByClassName("view-lines monaco-mouse-cursor-text")[0]
      );
      const codeLanguage = document.getElementsByClassName(
        "popover-wrapper inline-block"
      )[3].innerText;
      const formattedCode = formatCodeToMarkdown(code, codeLanguage);
  
      return `---
  difficulty: ${difficultyValue}
  created: ${currentTime}
  link: ${extractProblemUrl(window.location.href)}
  ${tags}
  ---
  
  # ${getProblemName()}
  
  ## Question
  
  ${question}
  
  # Algorithm
  
  ${formattedCode}
  
  # Complexities
  
  - Time:
  - Space:
  
  # Alternative Approach`;
    }
  
    function openObsidianLink() {
      GM_openInTab("obsidian://", { active: true, insert: true });
    }
  
    // Function to create the Obsidian document
    async function createObsidianDocument(
      obsidianUrl,
      documentPath,
      content,
      token
    ) {
      async function openInObsidian() {
        await fetch(`${obsidianUrl}/open${documentPath}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
  
      try {
        const fileExistsResponse = await fetch(
          `${obsidianUrl}/vault${documentPath}`,
          {
            method: "HEAD",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
  
        if (fileExistsResponse.status === 200) {
          console.log("File already exists.");
          openInObsidian()
          GM_notification({
            title: "Problem Exists!",
            text: `Please open your Obsidian editor to see it.`,
            timeout: 5000,
            onclick: openObsidianLink,
          });
          return;
        }
  
        const createResponse = await fetch(
          `${obsidianUrl}/vault${documentPath}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "text/markdown",
              Authorization: `Bearer ${token}`,
            },
            body: content,
          }
        );
  
        if (createResponse.ok) {
          openInObsidian()
          console.log(
            "Document created successfully:",
            createResponse.statusText
          );
          GM_notification({
            title: "Problem Imported Successfully",
            text: `Please open your Obsidian editor to see it.`,
            timeout: 5000,
            onclick: openObsidianLink,
          });
        } else {
          throw new Error(createResponse.statusText);
        }
      } catch (error) {
        console.error("Error creating document:", error.message);
        GM_notification({
          title: "Error Occurred",
          text: `Failed to create document: ${error.message}`,
          timeout: 5000,
        });
      }
    }
    saveToObsidian();
    // Register the menu command
    // GM_registerMenuCommand("Save LeetCode Problem to Obsidian", saveToObsidian);
  })();
  