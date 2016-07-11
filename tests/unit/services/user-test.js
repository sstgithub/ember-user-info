import { moduleFor, test } from 'ember-qunit';
import Pretender from 'pretender';

moduleFor('service:user', 'Unit | Service | user', {
  beforeEach() {
    this.server = new Pretender();
    this.server.prepareBody = JSON.stringify;
    this.server.prepareHeaders = function(headers) {
      headers['content-type'] = 'application/json';
      return headers;
    };
    this.returnHash = {
      "ip": "123.456.789",
      "country_name": "Country",
      "region_name": "State",
      "city": "City",
      "latitude": 33.333333,
      "longitude": 111.1111111,
      "zip_code": 12345
    };
    this.geo = {
      "city": "City",
      "country": "Country",
      "latitude": 33.333333,
      "longitude": 111.1111111,
      postal_code: 12345,
      region_name: "State"
    };
    this.coords = {"latitude": "33", "longitude": "111"};
  },
  afterEach() {
    this.server.shutdown();
  }
});

/*
 * Get IP
 *
*/


test('getIp function sets ip and geo url with ip', function(assert) {
  assert.expect(2);

  let user = this.subject();

  this.server.get('https://api.ipify.org', function() {
      return [200, {}, "123.456.789"];
  });

  user.getIp().then((value) => {
    assert.equal(value, "123.456.789");
    assert.equal(user.get('ip'), "123.456.789");
  });
});

test('getIp function does nothing if ip has already been set', function(assert) {
  assert.expect(2);

  let user = this.subject();
  user.set('ip', "111.111.111");

  user.getIp().then((value) => {
    assert.equal(value, "111.111.111");
    assert.equal(user.get('ip'), "111.111.111");
  });
});


/*
 * Get geo info from ip
 *
*/

test('getGeoFromIp function sets ip and geo from ip when neither one exists', function(assert) {
  assert.expect(3);

  let user = this.subject();

  this.server.get('https://freegeoip.net/json', () =>  {
     return [200, {}, this.returnHash];
  });

  user.getGeoFromIp().then((value) => {
    assert.deepEqual(value, this.geo);
    assert.equal(user.get('ip'), "123.456.789");
    assert.deepEqual(user.get('geo'), this.geo);
  });
});

test('getGeoFromIp function sets geo and keeps ip the same if the ip and geoWithIpUrl has already been set', function(assert) {
  assert.expect(3);

  let user = this.subject();
  user.set('ip', '111.111.111');
  user.set('geoWithIpUrl', 'https://freegeoip.net/json/111.111.111');

  this.server.get('https://freegeoip.net/json/111.111.111', () => {
     return [200, {}, this.returnHash];
  });


  user.getGeoFromIp().then((value) => {
    assert.deepEqual(value, this.geo);
    assert.equal(user.get('ip'), "111.111.111");
    assert.deepEqual(user.get('geo'), this.geo);
  });
});

test('getGeoFromIp function does nothing if geo has already been set', function(assert) {
  assert.expect(2);

  let user = this.subject();
  user.set('geo', this.coords);

  user.getGeoFromIp().then((value) => {
    assert.deepEqual(value, this.coords);
    assert.deepEqual(user.get('geo'), this.coords);
  });
});

/*
 * Geo from html5 geolocation request
 *
*/

test('if user allows geolocation and google api key not passed in then it will set coordinates only', function(assert) {
  assert.expect(3);

  let user = this.subject();
  let position = {"coords": this.coords};

  window.navigator.geolocation.getCurrentPosition = function(success){
    success(position);
  };

  user.requestAndSetGeoFromUser().then((value) => {
    assert.deepEqual(value, this.coords);
    assert.equal(user.get('geoFrom'), 'user');
    assert.deepEqual(user.get('geo'), this.coords);
  });
});

test('if user allows geolocation and google api key passed in then it will set coordinates and reverse geocode address info', function(assert) {
  assert.expect(3);

  let user = this.subject();
  let googleApiKey = "abc";
  let position = {"coords": this.coords};

  window.navigator.geolocation.getCurrentPosition = function(success){
    success(position);
  };

  let reverseGeocodeReturnHash = {"results": [{
      "types":["locality","political"],
      "formatted_address":"Winnetka, IL, USA",
      "address_components":[{
        "long_name":"Winnetka",
        "short_name":"Winnetka",
        "types":["locality","political"]
      },{
        "long_name":"Illinois",
        "short_name":"IL",
        "types":["administrative_area_level_1","political"]
      },{
        "long_name":"United States",
        "short_name":"US",
        "types":["country","political"]
      }],
      "geometry":{
        "location":[ -87.7417070, 42.1083080],
        "location_type":"APPROXIMATE"
      },
      "place_id": "ChIJW8Va5TnED4gRY91Ng47qy3Q"
    }]
  };

  this.server.get('https://maps.googleapis.com/maps/api/geocode/json/', function() {
    return [200, {}, reverseGeocodeReturnHash];
  });

  user.requestAndSetGeoFromUser(googleApiKey).then((value) => {
    let geo = {"city": "Winnetka", "country": "United States", "formatted_address": "Winnetka, IL, USA", "latitude": "33", "longitude": "111", "region_name": "Illinois"};
    assert.deepEqual(value, geo);
    assert.equal(user.get('geoFrom'), 'user');
    assert.deepEqual(user.get('geo'), geo);
  });
});

test('if user blocks geolocation then it will set geo using ip', function(assert) {
  assert.expect(3);

  let user = this.subject();

  window.navigator.geolocation.getCurrentPosition = function(_, failure){
    failure({"code": 1, "message": "User denied Geolocation"});
  };

  this.server.get('https://freegeoip.net/json', () => {
     return [200, {}, this.returnHash];
  });

  user.requestAndSetGeoFromUser().then((value) => {
    assert.deepEqual(value, {geo: this.geo, error: 'User denied Geolocation'});
    assert.equal(user.get('geoFrom'), 'ip');
    assert.deepEqual(user.get('geo'), this.geo);
  });
});

test('requesting geolocation from user does nothing if geo has already been set and it has been set using html5 geolocation', function(assert) {
  assert.expect(3);

  let user = this.subject();
  user.set('geo', this.coords);
  user.set('geoFrom', 'user');

  user.requestAndSetGeoFromUser().then((value) => {
    assert.deepEqual(value, this.coords);
    assert.deepEqual(user.get('geo'), this.coords);
    assert.equal(user.get('geoFrom'), 'user');
  });
});

