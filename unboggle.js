let solver = null;
let unboggle = null;
let unboggleInput = null;

window.addEventListener("load", function(){
	unboggle = document.getElementById("unboggle-board");

	// restrict input
	unboggleInput = document.getElementById("unboggle-input");
	unboggleInput.addEventListener("input", function(evt){
		let text = unboggleInput.value;
		unboggleInput.value = text.replace(/[^a-zA-Z\n\r]/g, "");
		unboggleInput.value = text.replace(/[^a-zA-Z\n\r]/g, "");
	});
});

function runUnboggler(){
	// validate dimensions
	let numRows = boggle.numRows;
	let numCols = boggle.numCols; 

	if(numRows != 4 || numCols != 4){
		console.log("sorry! unboggler only works with 4x4");
	}

	// get words
	let words = unboggleInput.value.toUpperCase().split("\n");
	let validWords = [];
	for(let k = 0; k < words.length; k++){
		let word = words[k];
		if(word.length == 0){ continue; }
		validWords.push(word);
	}

	// replace textarea
	unboggleInput.value = validWords.join("\n");
	
	// run unboggler
	encode(4, words);
}

//////////////////////////////////////////////////////////////////////

function encode(boardSize, words){
	solver = new Logic.Solver();

	// dimensions
	let numRows = boardSize;
	let numCols = boardSize;
	let numWords = words.length;

	let numRowBits = Math.ceil(Math.log2(numRows));
	let numColBits = Math.ceil(Math.log2(numCols));

	// bit constants
	let const_1  = Logic.constantBits(1);
	let const_25 = Logic.constantBits(25);
	let const_numRows = Logic.constantBits(numRows);
	let const_numCols = Logic.constantBits(numCols);

	// word constraints
	let wordPaths = [];

	for(let w = 0; w < numWords; w++){
		// translate word
		let word = words[w];
		let wordPath = [];
		let numLetters = word.length;

		for(let i = 0; i < word.length; i++){
			// location of ith letter stored in variables:
			//     p_(w)_(i)_x and p_(w)_(i)_y
			let pr = Logic.variableBits(`p_${w}_${i}_r`, numRowBits);
			let pc = Logic.variableBits(`p_${w}_${i}_c`, numColBits);
			wordPath.push([pr,pc]);

			// enforce board boundaries on paths (coordinates zero-indexed)
			solver.require(Logic.lessThan(pr, const_numRows));
			solver.require(Logic.lessThan(pc, const_numCols));

			// adjacent letters in word must be adjacent on board
			if(i > 0){
				// x difference
				solver.require(Logic.lessThanOrEqual(wordPath[i-1][0], Logic.sum(wordPath[i][0],   const_1)));
				solver.require(Logic.lessThanOrEqual(wordPath[i][0],   Logic.sum(wordPath[i-1][0], const_1)));
				// y difference
				solver.require(Logic.lessThanOrEqual(wordPath[i-1][1], Logic.sum(wordPath[i][1],   const_1)));
				solver.require(Logic.lessThanOrEqual(wordPath[i][1],   Logic.sum(wordPath[i-1][1], const_1)));
			}
		}

		// path cannot overlap itself
		for(let i = 0; i < word.length; i++){
			for(let j = i+1; j < word.length; j++){
				solver.require(Logic.atMostOne(
					Logic.equalBits(wordPath[i][0],wordPath[j][0]),
					Logic.equalBits(wordPath[i][1],wordPath[j][1])
				));
			}
		}

		wordPaths.push(wordPath);
	}

	// now, ensure word paths are all compatible
	for(let w1 = 0; w1 < numWords; w1++){
		for(let w2 = w1+1; w2 < numWords; w2++){
			let word1 = words[w1];
			let word2 = words[w2];

			for(let i = 0; i < word1.length; i++){
				for(let j = 0; j < word2.length; j++){
					// no constraint if words have letter in common
					if(word1[i] == word2[j]){ continue; }

					// prevent different letters from occupying same space
					solver.require(Logic.atMostOne(
						Logic.equalBits( wordPaths[w1][i][0], wordPaths[w2][j][0] ),
						Logic.equalBits( wordPaths[w1][i][1], wordPaths[w2][j][1] )
					));
				}
			}
		}
	}


	let solution = solver.solve();

	if(solution == null){
		console.log("No solution!");
	} else {
		decode(numRows, numCols, words, wordPaths, solution);
	}
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUV";

function decode(numRows, numCols, words, wordPaths, solution){
	// words
	let result = [];
	for(let r = 0; r < numRows; r++){
		let row = [];
		for(let c = 0; c < numCols; c++){
			row.push(".");
		}
		result.push(row);
	}

	for(let w = 0; w < words.length; w++){
		console.log(words[w]);
		
		for(let k = 0; k < words[w].length; k++){
			let pr = solution.evaluate(wordPaths[w][k][0]);
			let pc = solution.evaluate(wordPaths[w][k][1]);

			if(result[pr][pc] == "."){
				result[pr][pc] = words[w][k];
			} else if(result[pr][pc] != words[w][k]){
				console.log("DECODING ERROR!");
				return;
			}
		}
	}

	unboggle.fillBoard({
		numRows: numRows,
		numCols: numCols,
		data: result
	});

	let boardStr = "";
	for(let r = 0; r < numRows; r++){
		boardStr += result[r].join("") + "\n";
	}
	console.log(boardStr);
}