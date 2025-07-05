/*
This file is not an Ecmascript module because that would make
it not work when you paste it into a web browser debugger console.

To compile the scraper only to a Javascript file to run in the browser:
1. If needed, change the file extension of this file from .ts.txt to .ts.
2. On the terminal, run "tsc src/scraper/scraper.ts". It will generate scraper.js.

But when this file has .ts file extension, all the types from this file
will be visible to VS Code in the rest of the project. But since this file is NOT an
Ecmascript module it will not actually work when used in a web browser.

If you typecheck the entire project by running "tsc -noemit" when this file has .ts file extension,
you'll get this error:
    src/scraper/scraper.ts - error TS1208: 'scraper.ts' cannot be compiled under '--isolatedModules'
    because it is considered a global script file. Add an import, export, or an empty 'export {}'
    statement to make it a module.

Info about isolatedModules: https://www.typescriptlang.org/tsconfig/#isolatedModules

So when I am not editing this file I change the file extension to .ts.txt.

For this to work in a bookmarklet, all comments must be block comments not line
comments because the entire file becomes a single line in a bookmarklet!
*/
var CLUE_VALUES = [200, 400, 600, 800, 1000];
/** For Double Jeopardy, each dollar value is doubled. */
var CLUE_VALUE_MULTIPLIER = {
    "single": 1,
    "double": 2
};
function main() {
    /* This header contains the show number and the airdate. Example: "Show #8708 - Wednesday, September 28, 2022" */
    var h1Text = document.querySelector("h1").innerText;
    var result = {
        /* example URL: https://j-archive.com/showgame.php?game_id=7451 */
        J_ARCHIVE_GAME_ID: Number(new URLSearchParams(window.location.search).get("game_id")),
        SHOW_NUMBER: Number(/Show #(\d+)/.exec(h1Text)[1]),
        AIRDATE: h1Text.split(" - ")[1],
        ROUNDS: [
            parseTableForRound("single", document.querySelector("div#jeopardy_round table.round")),
            parseTableForRound("double", document.querySelector("div#double_jeopardy_round table.round")),
        ],
        FINAL_JEOPARDY: getFinalJeopardy()
    };
    var stringToCopyToClipboard = "\n        import { Game } from \"./typesForGame\";\n        export const SCRAPED_GAME: Game =    \n        ".concat(JSON.stringify(result, null, 2), ";\n        ");
    /* https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText */
    try {
      console.log("==DATA START==");
      console.log(stringToCopyToClipboard);
      console.log("==DATA END==");
      /*
        window.navigator.clipboard.writeText(stringToCopyToClipboard)
            // The promise resolves once the clipboard's contents have been updated
            .then(function () {
            var successMessage = document.createElement("span");
            successMessage.innerHTML = "Success, copied the game from J-Archive to the clipboard. You can put it in scrapedGame.ts.";
            successMessage.style.fontSize = "30px";
            successMessage.style.fontWeight = "bold";
            successMessage.style.background = "green";
            successMessage.style.border = "1px solid lime";
            successMessage.style.borderRadius = "5px";
            successMessage.style.padding = "15px 20px";
            successMessage.style.position = "fixed";
            successMessage.style.top = "10px";
            successMessage.style.left = "10px";
            successMessage.style.maxWidth = "1090px";
            document.body.append(successMessage);
        });
        */
    }
    catch (er) {
        window.alert("Clipboard write blocked by web browser: ".concat(String(er)));
    }
}
main();
function getFinalJeopardy() {
    var finalJeopardyContainer = document.querySelector("table.final_round");
    return {
        CATEGORY: finalJeopardyContainer.querySelector("td.category").innerText.trim(),
        QUESTION: finalJeopardyContainer.querySelector("td#clue_FJ").innerText,
        ANSWER: finalJeopardyContainer.querySelector("td#clue_FJ_r em.correct_response").innerText
    };
}
function parseTableForRound(roundType, table) {
    /*
    About the :scope pseudo-class:
    https://developer.mozilla.org/en-US/docs/Web/CSS/:scope

    About the > combinator (it does direct children):
    https://developer.mozilla.org/en-US/docs/Web/CSS/Child_combinator

    From https://stackoverflow.com/a/17206138/7376577
    */
    var rows = Array.from(table.querySelectorAll(":scope>tbody>tr"));
    if (rows.length !== 6) {
        throw new Error("got ".concat(rows.length, " row(s), expected exactly 6"));
    }
    var categoryRow = rows[0];
    var categories = Array.from(categoryRow.querySelectorAll("td.category")).
        map(function (td) {
        var rv = {
            NAME: td.querySelector("td.category_name").innerText
        };
        var commentsString = td.querySelector("td.category_comments").innerText.trim();
        if (commentsString.length > 0) {
            rv.COMMENT_FROM_TV_SHOW_HOST = commentsString;
        }
        return rv;
    });
    /* skip the first item in the list, it is the row of categories. */
    var clueRows = rows.slice(1);
    var clues = clueRows.map(function (clueRow, rowIndex) {
        return Array.from(clueRow.querySelectorAll("td.clue"))
            .map(function (tdClue, categoryIndex) {
            if (tdClue.childElementCount === 0) {
                /* Clue was NOT revealed on the TV show */
                return { REVEALED_ON_TV_SHOW: false };
            }
            else {
                /* Clue was revealed on the TV show */
                var directChildrenRowsOfTdClue = tdClue.querySelectorAll(":scope>table>tbody>tr");
                if (directChildrenRowsOfTdClue.length !== 2) {
                    throw new Error("the td.clue has ".concat(directChildrenRowsOfTdClue.length, " trs, expected exactly 2"));
                }
                var childRow = directChildrenRowsOfTdClue[1];
                /* Text which is shown on screen and the game host reads out loud. */
                var question = childRow.querySelector('td.clue_text:not([display="none"])').innerText;
                /* If a player says this, they get the money. */
                var answer = childRow.querySelector("td.clue_text em.correct_response").innerText;
                return {
                    REVEALED_ON_TV_SHOW: true,
                    QUESTION: question,
                    ANSWER: answer,
                    ROW_INDEX: rowIndex,
                    COLUMN_INDEX: categoryIndex,
                    VALUE: CLUE_VALUES[rowIndex] * CLUE_VALUE_MULTIPLIER[roundType],
                    CATEGORY_NAME: categories[categoryIndex].NAME
                };
            }
        });
    });
    return {
        TYPE: roundType,
        CATEGORIES: categories,
        CLUES: clues
    };
}
