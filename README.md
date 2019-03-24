# tg-contest-chart
A new era javascript charting library for TG contest

## More about that
* Vanila Javascript (es6)
* No dependencies (not even jquery)
* Based on html canvas
* Cardinal spline interpolation
* :cupid:

## Instalation & Usage
Please find .js and .css files located somewhere in the repo and include ones into your web page.
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
