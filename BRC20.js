
'use strict';

let globalAttribute = {};
const globalAttributeKey = 'global_attribute';

function makeAllowanceKey(owner, spender){
  return 'allow_' + owner + '_to_' + spender;
}

function approve(spender, value){
  Utils.assert(Utils.addressCheck(spender) === true, 'Arg-spender is not a valid address.');
  Utils.assert(Utils.stoI64Check(value) === true, 'Arg-value must be alphanumeric.');
  Utils.assert(Utils.int64Compare(value, '0') > 0, 'Arg-value of spender ' + spender + ' must be greater than 0.');

  let key = makeAllowanceKey(Chain.tx.sender, spender);
  Chain.store(key, value);

  Chain.tlog('approve', Chain.tx.sender, spender, value);

  return true;
}

function allowance(owner, spender){
  Utils.assert(Utils.addressCheck(owner) === true, 'Arg-owner is not a valid address.');
  Utils.assert(Utils.addressCheck(spender) === true, 'Arg-spender is not a valid address.');

  let key = makeAllowanceKey(owner, spender);
  let value = Chain.load(key);
  Utils.assert(value !== false, 'Failed to get the allowance given to ' + spender + ' by ' + owner + ' from metadata.');

  return value;
}

function transfer(to, value){
  Utils.assert(Utils.addressCheck(to) === true, 'Arg-to is not a valid address.');
  Utils.assert(Utils.stoI64Check(value) === true, 'Arg-value must be alphanumeric.');
  Utils.assert(Utils.int64Compare(value, '0') > 0, 'Arg-value must be greater than 0.');
  if(Chain.tx.sender === to) {
    Chain.tlog('transfer', Chain.tx.sender, to, value);
    return true;
  }

  let senderValue = Chain.load(Chain.tx.sender);
  Utils.assert(senderValue !== false, 'Failed to get the balance of ' + Chain.tx.sender + ' from metadata.');
  Utils.assert(Utils.int64Compare(senderValue, value) >= 0, 'Balance:' + senderValue + ' of sender:' + Chain.tx.sender + ' < transfer value:' + value + '.');

  let toValue = Chain.load(to);
  toValue = (toValue === false) ? value : Utils.int64Add(toValue, value);
  Chain.store(to, toValue);

  senderValue = Utils.int64Sub(senderValue, value);
  Chain.store(Chain.tx.sender, senderValue);

  Chain.tlog('transfer', Chain.tx.sender, to, value);

  return true;
}

function transferFrom(from, to, value){
  Utils.assert(Utils.addressCheck(from) === true, 'Arg-from is not a valid address.');
  Utils.assert(Utils.addressCheck(to) === true, 'Arg-to is not a valid address.');
  Utils.assert(Utils.stoI64Check(value) === true, 'Arg-value must be alphanumeric.');
  Utils.assert(Utils.int64Compare(value, '0') > 0, 'Arg-value must be greater than 0.');

  if(from === to) {
    Chain.tlog('transferFrom', Chain.tx.sender, from, to, value);
    return true;
  }

  let fromValue = Chain.load(from);
  Utils.assert(fromValue !== false, 'Failed to get the value, probably because ' + from + ' has no value.');
  Utils.assert(Utils.int64Compare(fromValue, value) >= 0, from + ' Balance:' + fromValue + ' < transfer value:' + value + '.');

  let allowValue = Utils.allowance(from, Chain.tx.sender);
  Utils.assert(Utils.int64Compare(allowValue, value) >= 0, 'Allowance value:' + allowValue + ' < transfer value:' + value + ' from ' + from + ' to ' + to  + '.');

  let toValue = Chain.load(to);
  toValue = (toValue === false) ? value : Utils.int64Add(toValue, value);
  Chain.store(to, toValue);

  fromValue = Utils.int64Sub(fromValue, value);
  Chain.store(from, fromValue);

  let allowKey = makeAllowanceKey(from, Chain.tx.sender);
  allowValue   = Utils.int64Sub(allowValue, value);
  Chain.store(allowKey, allowValue);

  Utils. tlog('transferFrom', Chain.tx.sender, from, to, value);

  return true;
}

function balanceOf(address){
  Utils.assert(Utils.addressCheck(address) === true, 'Arg-address is not a valid address.');

  let value = Chain.load(address);
  Utils.assert(value !== false, 'Failed to get the balance of ' + address + ' from metadata.');
  return value;
}

function init(input_str){
  let params = JSON.parse(input_str).params;

  Utils.assert(Utils.stoI64Check(params.supply) === true && params.supply > 0 &&
    typeof params.name === 'string' && params.name.length > 0 &&
    typeof params.symbol === 'string' && params.symbol.length > 0 &&
    typeof params.version === 'string' && params.version.length > 0 &&
    typeof params.decimals === 'number' && params.decimals >= 0,
    'Args check failed.');

  let i = 0;
  let power = 1;
  for(i = 0; i < params.decimals; i = i + 1){
    power = power * 10;
  }

  globalAttribute.totalSupply = Utils.int64Mul(params.supply, power);
  globalAttribute.name = params.name;
  globalAttribute.symbol = params.symbol;
  globalAttribute.version = params.version;
  globalAttribute.decimals = params.decimals;

  Chain.store(globalAttributeKey, JSON.stringify(globalAttribute));
  Chain.store(Chain.tx.sender, globalAttribute.totalSupply);
}

function main(input_str){
  let input = JSON.parse(input_str);

  if(input.method === 'transfer'){
    transfer(input.params.to, input.params.value);
  }
  else if(input.method === 'transferFrom'){
    transferFrom(input.params.from, input.params.to, input.params.value);
  }
  else if(input.method === 'approve'){
    approve(input.params.spender, input.params.value);
  }
  else{
    throw '<Main interface passes an invalid operation type>';
  }
}

function query(input_str){
  let result = {};
  let input  = JSON.parse(input_str);

  if(input.method === 'tokenInfo'){
    globalAttribute = JSON.parse(Chain.load(globalAttributeKey));
    result.tokenInfo = globalAttribute;
  }
  else if(input.method === 'allowance'){
    result.allowance = allowance(input.params.owner, input.params.spender);
  }
  else if(input.method === 'balanceOf'){
    result.balance = balanceOf(input.params.address);
  }
  else{
    throw '<Query interface passes an invalid operation type>';
  }
  return JSON.stringify(result);
}