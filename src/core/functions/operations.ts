export const opSet = (doc: any, update: any) => {
    for (const key in update) {
      if (update.hasOwnProperty(key)) {
        if (key.includes('[') && key.includes(']')) {
          const parts = key.split(/[\[\].]+/).filter(Boolean);
          let target = doc;
          while (parts.length > 1) {
            const part = parts.shift();
            if (part !== undefined) {
              if (!target[part]) {
                target[part] = isNaN(Number(parts[0])) ? {} : [];
              }
              target = target[part];
            }
          }
          const lastPart = parts[0];
          if (lastPart !== undefined) {
            target[lastPart] = update[key];
          }
        } else {
          doc[key] = update[key];
        }
      }
    }
  };

export const opUnset = (doc: any, update: any) => {
    const unsetValue = (target: any, key: string) => {
      if (Array.isArray(target)) {
        target.forEach((item: any) => {
          if (item && typeof item === 'object') {
            delete item[key];
          }
        });
      } else if (typeof target === 'object' && target !== null) {
        delete target[key];
      }
    };
  
    for (const key in update) {
      if (update.hasOwnProperty(key)) {
        const parts = key.split(/[\[\]\.]+/).filter(Boolean);
        let target = doc;
  
        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i];
          const index = parseInt(part, 10);
  
          if (!isNaN(index)) {
            if (!Array.isArray(target)) {
              throw new Error(`Invalid path for $unset operation: ${key}`);
            }
            if (!target[index]) {
              target[index] = {};
            }
            target = target[index];
          } else {
            if (!target[part]) {
              target[part] = {};
            }
            target = target[part];
          }
        }
  
        const lastPart = parts[parts.length - 1];
        unsetValue(target, lastPart);
      }
    }
};

export const opPush = (doc: any, update: any, upsert?: boolean) => {
    for (const key in update) {
      if (update.hasOwnProperty(key)) {
        let value = update[key];
        const parts = key.split(/[\[\]\.]+/).filter(Boolean);
        let target = doc;
  
        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i];
          const index = parseInt(part, 10);
  
          if (!isNaN(index)) {
            if (!Array.isArray(target)) {
              if (upsert) {
                target[part] = [];
              } else {
                throw new Error(`Invalid path for $push operation: ${key}`);
              }
            }
            if (!target[index]) {
              target[index] = {};
            }
            target = target[index];
          } else {
            if (!target[part]) {
              target[part] = isNaN(Number(parts[i + 1])) ? {} : [];
            }
            target = target[part];
          }
        }
  
        const lastPart = parts[parts.length - 1];
        if (value && typeof value === 'object' && value.$each) {
          value = value.$each;
        }
  
        if (Array.isArray(target[lastPart])) {
          if (Array.isArray(value)) {
            target[lastPart].push(...value);
          } else {
            target[lastPart].push(value);
          }
        } else if (upsert) {
          if (Array.isArray(value)) {
            target[lastPart] = target[lastPart] ? [].concat(target[lastPart], ...value) : [...value];
          } else {
            target[lastPart] = target[lastPart] ? [].concat(target[lastPart], value) : [value];
          }
        } else {
          throw new Error(`Invalid path for $push operation: ${key}`);
        }
      }
    }
};

export const opPull = (doc: any, update: any) => {
    const applyPull = (target: any, value: any) => {
      if (Array.isArray(value)) {
        value.forEach(val => {
          const index = target.indexOf(val);
          if (index > -1) {
            target.splice(index, 1);
          }
        });
      } else if (typeof value === 'object' && value !== null) {
        if (value.$each && Array.isArray(value.$each)) {
          value.$each.forEach((val: any) => {
            const index = target.indexOf(val);
            if (index > -1) {
              target.splice(index, 1);
            }
          });
        } else if (value.$all && Array.isArray(value.$all)) {
          value.$all.forEach((val: any) => {
            target = target.filter((item: any) => item !== val);
          });
        } else {
          target = target.filter((item: any) => {
            if (typeof item === 'object' && item !== null) {
              return !Object.keys(value).every(k => item[k] === value[k]);
            } else {
              return item !== value;
            }
          });
        }
      } else {
        const index = target.indexOf(value);
        if (index > -1) {
          target.splice(index, 1);
        }
      }
      return target;
    };
  
    for (const key in update) {
      if (update.hasOwnProperty(key)) {
        const value = update[key];
        const parts = key.split(/[\[\]\.]+/).filter(Boolean);
        let target = doc;
  
        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i];
          const index = parseInt(part, 10);
  
          if (!isNaN(index)) {
            if (!Array.isArray(target)) {
              throw new Error(`Invalid path for $pull operation: ${key}`);
            }
            if (!target[index]) {
              target[index] = {};
            }
            target = target[index];
          } else {
            if (!target[part]) {
              target[part] = {};
            }
            target = target[part];
          }
        }
  
        const lastPart = parts[parts.length - 1];
        if (Array.isArray(target[lastPart])) {
          target[lastPart] = applyPull(target[lastPart], value);
        } else {
          throw new Error(`Invalid path for $pull operation: ${key}`);
        }
      }
    }
};
  
export const opRename = (doc: any, update: any) => {
    for (const key in update) {
        if (update.hasOwnProperty(key)) {
            const newKey = update[key];
            const parts = key.split(/[\[\]\.]+/).filter(Boolean);
            let target = doc;

            for (let i = 0; i < parts.length - 1; i++) {
                const part = parts[i];
                const index = parseInt(part, 10);

                if (!isNaN(index)) {
                    if (!Array.isArray(target)) {
                        throw new Error(`Invalid path for $rename operation: ${key}`);
                    }
                    if (!target[index]) {
                        throw new Error(`Field to rename does not exist: ${key}`);
                    }
                    target = target[index];
                } else {
                    if (!target[part]) {
                        throw new Error(`Invalid path for $rename operation: ${key}`);
                    }
                    target = target[part];
                }
            }

            const lastPart = parts[parts.length - 1];
            if (!target.hasOwnProperty(lastPart)) {
                throw new Error(`Field to rename does not exist: ${key}`);
            }
            target[newKey] = target[lastPart];
            delete target[lastPart];
        }
    }
};

export const opAddToSet = (doc: any, update: any, upsert?: boolean) => {
  for (const key in update) {
      if (update.hasOwnProperty(key)) {
          const value = update[key];
          const parts = key.split(/[\[\]\.]+/).filter(Boolean);
          let target = doc;

          for (let i = 0; i < parts.length - 1; i++) {
              const part = parts[i];
              const index = parseInt(part, 10);

              if (!isNaN(index)) {
                  if (!Array.isArray(target)) {
                      if (upsert) {
                          target[part] = [];
                      } else {
                          throw new Error(`Invalid path for $addToSet operation: ${key}`);
                      }
                  }
                  if (!target[index]) {
                      target[index] = {};
                  }
                  target = target[index];
              } else {
                  if (!target[part]) {
                      target[part] = isNaN(Number(parts[i + 1])) ? {} : [];
                  }
                  target = target[part];
              }
          }

          const lastPart = parts[parts.length - 1];
          if (!Array.isArray(target[lastPart])) {
              if (upsert) {
                  target[lastPart] = [];
              } else {
                  throw new Error(`Invalid path for $addToSet operation: ${key}`);
              }
          }

          if (value.$each && Array.isArray(value.$each)) {
              for (const item of value.$each) {
                  if (typeof item === 'object') {
                      const exists = target[lastPart].some((existingItem: any) => {
                          return JSON.stringify(existingItem) === JSON.stringify(item);
                      });
                      if (!exists) {
                          target[lastPart].push(item);
                      }
                  } else if (!target[lastPart].includes(item)) {
                      target[lastPart].push(item);
                  }
              }
          } else if (value.$all && Array.isArray(value.$all)) {
              for (const item of value.$all) {
                  if (typeof item === 'object') {
                      const exists = target[lastPart].some((existingItem: any) => {
                          return JSON.stringify(existingItem) === JSON.stringify(item);
                      });
                      if (!exists) {
                          target[lastPart].push(item);
                      }
                  } else if (!target[lastPart].includes(item)) {
                      target[lastPart].push(item);
                  }
              }
          } else {
              if (typeof value === 'object') {
                  const exists = target[lastPart].some((existingItem: any) => {
                      return JSON.stringify(existingItem) === JSON.stringify(value);
                  });
                  if (!exists) {
                      target[lastPart].push(value);
                  }
              } else if (!target[lastPart].includes(value)) {
                  target[lastPart].push(value);
              }
          }
      }
  }
};

export const opMin = (doc: any, update: any, upsert?: boolean) => {
  for (const key in update) {
      if (update.hasOwnProperty(key)) {
          const value = update[key];
          const parts = key.split(/[\[\]\.]+/).filter(Boolean);
          let target = doc;

          for (let i = 0; i < parts.length - 1; i++) {
              const part = parts[i];
              const index = parseInt(part, 10);

              if (!isNaN(index)) {
                  if (!Array.isArray(target)) {
                      if (upsert) {
                          target[part] = [];
                      } else {
                          throw new Error(`Invalid path for $min operation: ${key}`);
                      }
                  }
                  if (!target[index]) {
                      if (upsert) {
                          target[index] = {};
                      } else {
                          throw new Error(`Invalid path for $min operation: ${key}`);
                      }
                  }
                  target = target[index];
              } else {
                  if (!target[part]) {
                      if (upsert) {
                          target[part] = isNaN(Number(parts[i + 1])) ? {} : [];
                      } else {
                          throw new Error(`Invalid path for $min operation: ${key}`);
                      }
                  }
                  target = target[part];
              }
          }

          const lastPart = parts[parts.length - 1];
          if (target[lastPart] === undefined || target[lastPart] > value) {
              target[lastPart] = value;
          }
      }
  }
};

export const opMax = (doc: any, update: any, upsert?: boolean) => {
  for (const key in update) {
      if (update.hasOwnProperty(key)) {
          const value = update[key];
          const parts = key.split(/[\[\]\.]+/).filter(Boolean);
          let target = doc;

          for (let i = 0; i < parts.length - 1; i++) {
              const part = parts[i];
              const index = parseInt(part, 10);

              if (!isNaN(index)) {
                  if (!Array.isArray(target)) {
                      if (upsert) {
                          target[part] = [];
                      } else {
                          throw new Error(`Invalid path for $max operation: ${key}`);
                      }
                  }
                  if (!target[index]) {
                      if (upsert) {
                          target[index] = {};
                      } else {
                          throw new Error(`Invalid path for $max operation: ${key}`);
                      }
                  }
                  target = target[index];
              } else {
                  if (!target[part]) {
                      if (upsert) {
                          target[part] = isNaN(Number(parts[i + 1])) ? {} : [];
                      } else {
                          throw new Error(`Invalid path for $max operation: ${key}`);
                      }
                  }
                  target = target[part];
              }
          }

          const lastPart = parts[parts.length - 1];
          if (target[lastPart] === undefined || target[lastPart] < value) {
              target[lastPart] = value;
          }
      }
  }
};

export const opMul = (doc: any, update: any, upsert?: boolean) => {
  for (const key in update) {
      if (update.hasOwnProperty(key)) {
          const value = update[key];
          const parts = key.split(/[\[\]\.]+/).filter(Boolean);
          let target = doc;

          for (let i = 0; i < parts.length - 1; i++) {
              const part = parts[i];
              const index = parseInt(part, 10);

              if (!isNaN(index)) {
                  if (!Array.isArray(target)) {
                      if (upsert) {
                          target[part] = [];
                      } else {
                          throw new Error(`Invalid path for $mul operation: ${key}`);
                      }
                  }
                  if (!target[index]) {
                      if (upsert) {
                          target[index] = {};
                      } else {
                          throw new Error(`Invalid path for $mul operation: ${key}`);
                      }
                  }
                  target = target[index];
              } else {
                  if (!target[part]) {
                      if (upsert) {
                          target[part] = isNaN(Number(parts[i + 1])) ? {} : [];
                      } else {
                          throw new Error(`Invalid path for $mul operation: ${key}`);
                      }
                  }
                  target = target[part];
              }
          }

          const lastPart = parts[parts.length - 1];
          if (typeof target[lastPart] === 'number') {
              target[lastPart] *= value;
          } else if (upsert) {
              target[lastPart] = value;
          } else {
              throw new Error(`Invalid target for $mul operation: ${key}`);
          }
      }
  }
};

export const opInc = (doc: any, update: any, upsert?: boolean) => {
  const incrementValue = (target: any, key: string, value: any) => {
      if (typeof target[key] === 'number') {
          target[key] += value;
      } else if (Array.isArray(target[key])) {
          target[key] = target[key].map((item: any) => {
              if (typeof item === 'number') {
                  return item + value;
              }
              return item;
          });
      } else if (typeof target[key] === 'object' && target[key] !== null) {
          opInc(target[key], { ...value }, upsert);
      } else if (upsert) {
          opSet(doc, update);
          return;
      } else {
          throw new Error(`Invalid target for $inc operation: ${key}`);
      }
  };

  for (const key in update) {
      if (update.hasOwnProperty(key)) {
          const value = update[key];
          const parts = key.split(/[\[\].]+/).filter(Boolean);
          let target = doc;

          for (let i = 0; i < parts.length - 1; i++) {
              const part = parts[i];
              const index = parseInt(part, 10);

              if (!isNaN(index)) {
                  if (!Array.isArray(target)) {
                      if (upsert) {
                          opSet(doc, update);
                          target = target[index];
                          return
                      } else {
                          throw new Error(`Invalid path for $inc operation: ${key}`);
                      }
                  } else {
                      if (!target[index]) {
                          if (upsert) {
                              opSet(doc, update);
                              target = target[index];
                              return
                          } else {
                              throw new Error(`Invalid path for $inc operation: ${key}`);
                          }
                      } else {
                          target = target[index];
                      }
                  }
              } else {
                  if (!target[part]) {
                      if (upsert) {
                          opSet(doc, update);
                          target = target[part];
                          return
                      } else {
                          throw new Error(`Invalid path for $inc operation: ${key}`);
                      }
                  } else {
                      target = target[part];
                  }
              }
          }

          const lastPart = parts[parts.length - 1];
          const arrayIndex = parseInt(lastPart, 10);
          if (!isNaN(arrayIndex) && Array.isArray(target)) {
              if (upsert && !target[arrayIndex]) {
                  target[arrayIndex] = {};
              }
              const nestedTarget = target[arrayIndex];
              if (nestedTarget && typeof nestedTarget === 'object') {
                  incrementValue(nestedTarget, '', value);
              } else if (upsert) {
                  opSet(doc, update);
                  return
              } else {
                  throw new Error(`Invalid path for $inc operation: ${key}`);
              }
          } else {
              incrementValue(target, lastPart, value);
          }
      }
  }
};

export const opBit = (doc: any, update: any, upsert = false) => {
  const applyBitOperation = (currentValue: number, bitUpdate: any) => {
      for (const op in bitUpdate) {
          if (bitUpdate.hasOwnProperty(op)) {
              const value = bitUpdate[op];
              switch (op) {
                  case "and":
                      currentValue &= value;
                      break;
                  case "or":
                      currentValue |= value;
                      break;
                  case "xor":
                      currentValue ^= value;
                      break;
                  default:
                      throw new Error(`Invalid bitwise operation: ${op}`);
              }
          }
      }
      return currentValue;
  };

  for (const key in update) {
      if (update.hasOwnProperty(key)) {
          const value = update[key];
          const parts = key.split(/[\[\]\.]+/).filter(Boolean);
          let target = doc;

          for (let i = 0; i < parts.length - 1; i++) {
              const part = parts[i];
              const index = parseInt(part, 10);

              if (!isNaN(index)) {
                  if (!Array.isArray(target)) {
                      if (upsert) {
                          target[part] = [];
                      } else {
                          throw new Error(`Invalid path for $bit operation: ${key}`);
                      }
                  }
                  if (!target[index]) {
                      if (upsert) {
                          target[index] = {};
                      } else {
                          throw new Error(`Invalid path for $bit operation: ${key}`);
                      }
                  }
                  target = target[index];
              } else {
                  if (!target[part]) {
                      if (upsert) {
                          target[part] = isNaN(Number(parts[i + 1])) ? {} : [];
                      } else {
                          throw new Error(`Invalid path for $bit operation: ${key}`);
                      }
                  }
                  target = target[part];
              }
          }

          const lastPart = parts[parts.length - 1];
          if (typeof target[lastPart] === 'number') {
              target[lastPart] = applyBitOperation(target[lastPart], value);
          } else if (upsert) {
              target[lastPart] = applyBitOperation(0, value);
          } else {
              throw new Error(`Invalid target for $bit operation: ${key}`);
          }
      }
  }
};

export const opPop = (doc: any, update: any, upsert?: boolean) => {
  for (const key in update) {
    if (update.hasOwnProperty(key)) {
      const value = update[key];
      const parts = key.split(/[\[\].]+/).filter(Boolean);
      let target = doc;

      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        const index = parseInt(part, 10);

        if (!isNaN(index)) {
          if (!Array.isArray(target)) {
            if (upsert) {
              target[part] = [];
            } else {
              throw new Error(`Invalid path for $pop operation: ${key}`);
            }
          }
          if (!target[index]) {
            if (upsert) {
              target[index] = {};
            } else {
              throw new Error(`Invalid path for $pop operation: ${key}`);
            }
          }
          target = target[index];
        } else {
          if (!target[part]) {
            if (upsert) {
              target[part] = isNaN(Number(parts[i + 1])) ? {} : [];
            } else {
              throw new Error(`Invalid path for $pop operation: ${key}`);
            }
          }
          target = target[part];
        }
      }

      const lastPart = parts[parts.length - 1];
      if (!Array.isArray(target[lastPart])) {
        throw new Error(`Target for $pop operation is not an array: ${key}`);
      }

      if (value === 1) {
        target[lastPart].pop();
      } else if (value === -1) {
        target[lastPart].shift();
      } else {
        throw new Error(`Invalid value for $pop operation: ${value}`);
      }
    }
  }
};

export const opCurrentDate = (doc: any, update: any, upsert?: boolean) => {
  for (const key in update) {
    if (update.hasOwnProperty(key)) {
      const value = update[key];
      const parts = key.split(/[\[\].]+/).filter(Boolean);
      let target = doc;

      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!target[part]) {
          if (upsert) {
            target[part] = {};
          } else {
            throw new Error(`Invalid path for $currentDate operation: ${key}`);
          }
        }
        target = target[part];
      }

      const lastPart = parts[parts.length - 1];
      if (value === true) {
        target[lastPart] = new Date().toLocaleString();
      } else if (value && value.$type === 'date') {
        target[lastPart] = new Date().toLocaleString();
      } else if (value && value.$type === 'timestamp') {
        target[lastPart] = Date.now();
      } else {
        throw new Error(`Invalid value for $currentDate operation: ${value}`);
      }
    }
  }
};

export const opSlice = (doc: any, update: any, upsert?: boolean) => {
  const sliceArray = (array: any[], value: number) => {
    if (!Array.isArray(array)) {
      throw new Error(`$slice operation can only be applied to arrays`);
    }
    if (value === 0 || value < 0) {
      throw new Error(`Invalid value for $slice operation: ${value}`);
    }
    return array.slice(0, value);
  };

  for (const key in update) {
    if (update.hasOwnProperty(key)) {
      const value = update[key];
      const parts = key.split(/[\[\].]+/).filter(Boolean);
      let target = doc;

      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!target[part]) {
          if (upsert) {
            target[part] = isNaN(Number(parts[i + 1])) ? {} : [];
          } else {
            throw new Error(`Invalid path for $slice operation: ${key}`);
          }
        }
        target = target[part];
      }

      const lastPart = parts[parts.length - 1];
      if (!Array.isArray(target[lastPart])) {
        throw new Error(`Invalid path for $slice operation: ${key}`);
      }

      target[lastPart] = sliceArray(target[lastPart], value);
    }
  }
};

export const opSort = (doc: any, update: any, upsert?: boolean) => {
  for (const key in update) {
    if (update.hasOwnProperty(key)) {
      const value = update[key];
      const parts = key.split(/[\[\]\.]+/).filter(Boolean);
      let target = doc;

      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!target[part]) {
            throw new Error(`Invalid path for $sort operation: ${key}`);
        }
        target = target[part];
      }

      const lastPart = parts[parts.length - 1];
      if (!Array.isArray(target[lastPart])) {
        throw new Error(`Invalid path for $sort operation: ${key}`);
      }

      if (value !== 1 && value !== -1) {
        throw new Error(`Invalid sort order for $sort operation: ${value}`);
      }

      target[lastPart].sort((a: any, b: any) => {
        return a - b;
      });

      if (value === -1) {
        target[lastPart].reverse();
      }
    }
  }
};
