# tg-contest-chart
A new era javascript charting library for TG contest.

Git pages self link [https://vitya1.github.io/tgcahrty/]

## More about that
* Vanila Javascript (es6)
* No dependencies (not even jquery)
* Based on html canvas
* Cardinal spline interpolation
* :cupid:

## Instalation & Usage
First of all start a tiny nodejs api server with command
```
#do not forget about npm install
node api.js
``` 
Datasets are located in ./data folder. So AJAX requests would be like /data/1/2018-04/08.json

Then find .js and .css files located somewhere in the repo and include ones into your web page.
Than just initialise your chart like in example bellow:

*index.html*
```
...
<div id="chart"></div>
...
```
*index.js*
```
const data = JSON.parse(raw_data);
new TgChart({
    id: 'chart',
    data: {
        //...look for exaple in the repo
    }
});

```


Thanks for reading!
