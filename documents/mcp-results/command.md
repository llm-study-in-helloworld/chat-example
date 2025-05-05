create report that contain investigation of step 1 and graph by step 3, suggestions to fix on backend related files

steps
1. use load our test result using filesystem.read_multiple_files on k6-test/results/**/*.log.
2. using that log, generate json to use on generating chart
3. gerate graphs using quickchart-server.generate_chart with result of 2
4. generate reports