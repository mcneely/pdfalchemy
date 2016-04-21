var pdf2json = require('pdf2json');
var Alchemy = function(config) {
    this.setConfig(config);
};

Alchemy.prototype.setConfig  = function(config) {
    this.DEFAULT_CONFIG = {
        "rows": {
            "compress":true,
            "flatten": false,
            "separator": "\n",
            "magicJoin": false
        },
        "columns": {
            "compress" : true,
            "flatten"  : false,
            "separator": ",",
            "magicJoin": false
        }
    };

    this.config = config || this.DEFAULT_CONFIG;
};

Alchemy.prototype.getConfig = function(keyString) {
    var traverse = function(object, keyString) {
        var keyArray = keyString.split('.');
        return keyArray.reduce(function(object, key){
            return object[key] || false;
        }, object)
    };

    var def = traverse(this.DEFAULT_CONFIG, keyString);
    var val = traverse(this.config, keyString);
    return (val) ? val : def;
};

Alchemy.prototype.parse = function(pdfFilePath, callBack) {

    var subtract = function(a, b) {
        return a - b;
    };

    var numArrSort =function(array) {
        return array.sort(subtract);
    };

    var arrJoin = function(array, doJoin, separator) {
        doJoin    = doJoin || false;
        separator = separator || '';
        return (doJoin) ? array.join(separator) : array;
    };

    var allKeys = function(array) {
        var arr = [];
        for (var i = 0; i <= array.length; i++) {
            arr.push(i);
        }
        return arr;
    };

    var getKeys = function(array, compress) {
        return numArrSort((compress || false) ? Object.keys(array) :allKeys(array));
    };

    var cleanup = function(error, success) {
        pdfParser.destroy();
        callBack(error || false, success || false);
    };

    var getX = function(grid, x, y) {
        var tmpX = x;
        if (this.getConfig('columns.magicJoin')) {
            tmpX = ('undefined' !== typeof grid[y][x - 1]) ? x - 1 : tmpX;
            tmpX = ('undefined' !== typeof grid[y][x - 2]) ? x - 2 : tmpX;
        }
        return tmpX;
    }.bind(this);

    var getY = function(grid, x, y, map) {
        var tmpY = y;
        if (this.getConfig('rows.magicJoin')) {
            //var tmpX = ('undefined' !== typeof original[y - 1][x] && 'undefined' !== typeof grid[y - 1]) ? getX(grid, x, y - 1) : x;
            //tmpY     = (tmpX !== x) ? y - 1 : y;
        }
        return tmpY;
    }.bind(this);

    var generateGridMap = function(page) {
        var colArray = [];
        var rowArray = [];
        var map = {
            "columns": {
                "coord" : {},
                "number": {}
            },
            "rows"   : {
                "coord" : {},
                "number": {}
            },
            "texts":{}
        };


        page.Texts.forEach(function(text, index) {
            var col  = text.x;
            var row  = text.y;
            if (colArray.indexOf(col) == -1) {
                colArray.push(col)
            }
            if (rowArray.indexOf(row) == -1) {
                rowArray.push(row)
            }

            var result = text.R.reduce(function(previous, current) {
                return previous + current.T;
            }, "");

            map.texts[row]      = (map.texts.hasOwnProperty(row)) ? map.texts[row] : {};
            map.texts[row][col] = decodeURIComponent(result);
        });



        var setValue = function(value, index, array, magic) {
            var coord = value;
            var key   = index;
            if (index > 0 && magic) {
                for (var i = 0; i < index; i++) {
                    if (Math.abs(value - array[i]) < 2.5) {
                        key = i;
                        break;
                    }
                }
            }
            this.coord[coord] = key;
            this.number[key] = (this.number.hasOwnProperty(key)) ? this.number[key] : [];
            this.number[key].push(coord);
            this.number[key] = numArrSort(this.number[key]);
        };

        var setMagicValue = function(value, index, array) {
            setValue(value, index, array, true).bind(this);
        };




        rowArray = numArrSort(rowArray);
        colArray = numArrSort(colArray);


        var rows=map.rows;
        var columns = map.columns;
        var rowValue = (this.getConfig('rows.magicJoin'))    ? setMagicValue : setValue;
        var colValue = (this.getConfig('columns.magicJoin')) ? setMagicValue : setValue;
        rowArray.forEach(rowValue, rows);
        colArray.forEach(colValue, columns);
        map.rows    = rows;
        map.columns = columns;


        return map;
    }.bind(this);

    var pageToGrid = function(page) {
        var map = generateGridMap(page);
        var grid = [];
        page.Texts.forEach(function(text) {
            var x                = text.x;
            var y                = text.y;
            var col              = map.columns.coord[x];
            var row              = map.rows.coord[y];
            var result = text.R.reduce(function(previous, current) {
                return previous + current.T;
            }, "");
            var value            = decodeURIComponent(result);
            var newRow           = getY(grid, col, row, map);
            grid[newRow]         = grid[newRow] || Object.keys(map.columns.number).map(function() {return ''; });
            var newCol           = getX(grid, col, newRow, map);
            grid[newRow][newCol] = value;
        });
        return grid;
    };

    var pdfParser = new pdf2json();
    var parseResult = function(result) {
        var pages = result.data.Pages.map(function(page) {
            var grid = pageToGrid(page);
            return arrJoin(getKeys(grid, this.getConfig('rows.compress'))
               .map(function(key) {
                   return arrJoin(getKeys(grid[key], this.getConfig('columns.compress'))
                      .map(function(col) {
                          return grid[key][col] || null;
                      }), this.getConfig('columns.flatten'), this.getConfig('columns.separator'));
               }, this), this.getConfig('rows.flatten'), this.getConfig('rows.separator'));
        }, this);
        cleanup(false, pages);
    };

    pdfParser.on('pdfParser_dataError', cleanup.bind(this));
    pdfParser.on('pdfParser_dataReady', parseResult.bind(this));
    pdfParser.loadPDF(pdfFilePath);
};

module.exports = Alchemy;