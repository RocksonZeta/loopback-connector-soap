'use strict';
var should = require('should');
var loopback = require('loopback');
var path = require('path');
var fs = require('fs');
var assert = require('assert');

describe('wsdl configuration', function() {
	this.timeout(1000000)
	it('should be able to derive wsdl from url', function(done) {
		var ds = loopback.createDataSource('soap', {
			connector: require('../index'),
			wsdl: 'http://wsf.cdyne.com/WeatherWS/Weather.asmx?wsdl' // The service endpoint
		});
		// console.log(ds);
		var WeatherService = ds.createModel('WeatherService', {});
		WeatherService.invoke({
			methods: {
				GetCityForecastByZIP: {ZIP:"95131"}
			}
		} ,console.log);
	});

});