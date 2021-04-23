interface IIndexedDBWrapper {
  add: (iterable: Array<any>) => Promise<Iterable<any>>
  getAll: () => Promise<Array<any>>
}

interface IndexedDBFactoryWrapper {
  open: (databaseName: string) => IDBOpenDBRequest
}

interface ObjectStoreWrapper {
  createIndex: (indexName: string, keyPath: string, options: { unique: boolean }) => void
}

interface IDBDatabaseWrapper {
  createObjectStore: (name: string, options: { keyPath: string }) => ObjectStoreWrapper,
}

type ObjectStoreConstructor = (db: IDBDatabaseWrapper) => void;

const IndexedDBWrapper = (function ief(_impl: IndexedDBFactoryWrapper) {
  // eslint-disable-next-line max-len
  function IndexedDBRequestWrapper(idbRequest: IDBRequest, objectStoreConstructor?: ObjectStoreConstructor): Promise<any> {
    return new Promise((resolve, reject) => {
      // error event : request
      // eslint-disable-next-line no-param-reassign
      idbRequest.onerror = function onerror(event) {
        return reject(event);
      };

      // success event : request
      // eslint-disable-next-line no-param-reassign
      idbRequest.onsuccess = function onerror() {
        return resolve(idbRequest.result);
      };

      // This event handles the event whereby a new version of
      // the database needs to be created Either one has not
      // been created before, or a new version number has been
      // submitted via the window.indexedDB.open line above
      // it is only implemented in recent browsers
      // eslint-disable-next-line no-param-reassign
      if (idbRequest instanceof IDBOpenDBRequest) {
        // eslint-disable-next-line no-param-reassign
        idbRequest.onupgradeneeded = function onupgradeneeded(/* event */) {
          const db = idbRequest.result;
          // this appears to be synchronous and not a request type
          // we just ignore and wait until open resolves
          if (objectStoreConstructor) {
            objectStoreConstructor(db);
          }
        };
      }
    });
  }

  return {
    // eslint-disable-next-line max-len
    new(databaseName: string, objectStoreName: string, objectStoreConstructor: ObjectStoreConstructor, impl = _impl): Promise<IIndexedDBWrapper> {
      return new Promise((resolve, reject) => {
        const request = impl.open(databaseName);

        const wrapped = IndexedDBRequestWrapper(request, objectStoreConstructor);

        return wrapped
          .then((db) => {
            // store the result of opening the database in the db
            // variable. This is used a lot below
            let transaction;
            try {
              transaction = db.transaction([objectStoreName], 'readwrite');
            } catch (error) {
              return Promise.reject(error);
            }

            let objectStore: IDBObjectStore;
            try {
              objectStore = transaction.objectStore(objectStoreName);
            } catch (error) {
              return Promise.reject(error);
            }

            return resolve({
              add(iterable: Array<any>): Promise<Iterable<any>> {
                const addRequestGenerator = (item: any) => {
                  const addRequest = objectStore.add(item);
                  return IndexedDBRequestWrapper(addRequest);
                };
                const promises = iterable.map(addRequestGenerator);
                return Promise.all(promises);
              },
              getAll() {
                return IndexedDBRequestWrapper(objectStore.getAll());
              },
            });
          })
          .catch((error) => reject(error));
      });
    },
  };
}(window.indexedDB));

// eslint-disable-next-line max-len
interface MockOptions { shouldAdd?: boolean, shouldGetAll?: boolean, shouldOpen?: boolean, key: string }
const defaultMockOptions = {
  shouldAdd: true, shouldGetAll: true, shouldOpen: true, key: 'taskTitle',
};
function mockImpl(mockOptions: MockOptions = defaultMockOptions) {
  const {
    shouldAdd, shouldGetAll, shouldOpen, key,
  } = {
    shouldAdd: mockOptions.shouldAdd !== undefined ? mockOptions.shouldAdd : true,
    shouldGetAll: mockOptions.shouldGetAll !== undefined ? mockOptions.shouldGetAll : true,
    shouldOpen: mockOptions.shouldOpen !== undefined ? mockOptions.shouldOpen : true,
    key: mockOptions.key,
  };

  const items: Array<any> = [];

  interface MockSetFunctionOptions {
    succeed: boolean, error?: string
  }

  type MSFO = MockSetFunctionOptions

  const set = (mockSetFuncOpts: MSFO) => (_obj: any, name: string, func: any) => {
    if (name === 'onsuccess' && mockSetFuncOpts.succeed) {
      func();
    }

    if (name === 'onerror' && !mockSetFuncOpts.succeed) {
      func({ error: `We messed up: ${mockSetFuncOpts.error}` });
    }

    return true;
  };

  function getAll() {
    const request = {
      result: items,
    };
    return new Proxy(
      request,
      {
        set: set({ succeed: shouldGetAll, error: 'getAll' }),
      },
    );
  }

  function add(item: any) {
    items.push(item);
    const request = {
      result: item[key],
    };
    return new Proxy(
      request,
      {
        set: set({ succeed: shouldAdd, error: 'add' }),
      },
    );
  }

  // eslint-disable-next-line no-unused-vars
  function objectStore(_objectStoreName: string) {
    return {
      add,
      getAll,
    };
  }

  // eslint-disable-next-line no-unused-vars
  function transaction(_objectStoreName: string, _mode: string) {
    return {
      objectStore,
    };
  }

  const request = {
    result: {
      transaction,
    },
  };

  return {
    open() {
      return new Proxy(
        request,
        {
          set: set({ succeed: shouldOpen, error: 'open' }),
        },
      );
    },
  };
}

const toDoListObjectStoreConstructor: ObjectStoreConstructor = (db: IDBDatabaseWrapper) => {
  // Create an objectStore for this database
  const objectStore = db.createObjectStore('toDoList', { keyPath: 'taskTitle' });

  // define what data items the objectStore will contain

  objectStore.createIndex('hours', 'hours', { unique: false });
  objectStore.createIndex('minutes', 'minutes', { unique: false });
  objectStore.createIndex('day', 'day', { unique: false });
  objectStore.createIndex('month', 'month', { unique: false });
  objectStore.createIndex('year', 'year', { unique: false });
  objectStore.createIndex('notified', 'notified', { unique: false });
};

const realWrapper = () => IndexedDBWrapper.new('some_named_database', 'toDoList', toDoListObjectStoreConstructor);
const withWorkingMockedIndexedDB = () => IndexedDBWrapper.new('some_named_database', 'toDoList', toDoListObjectStoreConstructor, mockImpl());
const withBrokenOpen = () => IndexedDBWrapper.new('some_named_database', 'toDoList', toDoListObjectStoreConstructor, mockImpl({ shouldOpen: false, key: 'taskTitle' }));
const withBrokenAdd = () => IndexedDBWrapper.new('some_named_database', 'toDoList', toDoListObjectStoreConstructor, mockImpl({ shouldAdd: false, key: 'taskTitle' }));
const withBrokenGetAll = () => IndexedDBWrapper.new('some_named_database', 'toDoList', toDoListObjectStoreConstructor, mockImpl({ shouldGetAll: false, key: 'taskTitle' }));

interface TestCaseOptions {
  mock: Promise<IIndexedDBWrapper>,
  expectedGetAllResult: any,
  expectedAddResult: any,
  random: number
}

function withRandom(func: (random: number) => TestCaseOptions): TestCaseOptions {
  return func(Math.random());
}

const testCases = [
  withRandom((random: number) => ({
    mock: realWrapper(), expectedGetAllResult: undefined, expectedAddResult: undefined, random,
  })),
  withRandom((random: number) => ({
    mock: withWorkingMockedIndexedDB(),
    expectedGetAllResult: [{
      taskTitle: `Walk dog #${random}`, hours: 19, minutes: 30, day: 24, month: 11, year: 2013, notified: 'no',
    }],
    expectedAddResult: [`Walk dog #${random}`],
    random,
  })),
  withRandom((random: number) => ({
    mock: withBrokenOpen(), expectedGetAllResult: [], expectedAddResult: [{}], random,
  })),
  withRandom((random: number) => ({
    mock: withBrokenAdd(), expectedGetAllResult: [], expectedAddResult: [{}], random,
  })),
  withRandom((random: number) => ({
    mock: withBrokenGetAll(),
    expectedGetAllResult: [],
    expectedAddResult: [`Walk dog #${random}`],
    random,
  })),
];

function presentWhatsInTheDatabase(items: Array<any>) {
  const div = document.createElement('div');
  document.body.appendChild(div);
  items.forEach((item: any) => {
    const itemRepr = document.createElement('div');
    itemRepr.setAttribute('class', 'beautiful-todo-item');
    itemRepr.textContent = `Task Title: ${item.taskTitle} | Due: ${new Date(item.year, item.month, item.day, item.hours, item.minutes, 0)} | Notified: ${item.notified}`;
    div.appendChild(itemRepr);
  });
}

testCases.forEach(({
  mock, expectedGetAllResult, expectedAddResult, random,
}) => {
  mock
    .then((db) => {
      const newItem = {
        taskTitle: `Walk dog #${random}`, hours: 19, minutes: 30, day: 24, month: 11, year: 2013, notified: 'no',
      };
      return db.add([newItem])
        .then((result: any) => ({ db, result }));
    })
    .then(({ db, result }) => {
      if (expectedAddResult && (JSON.stringify(result) !== JSON.stringify(expectedAddResult))) {
        return Promise.reject(new Error('our test failed'));
      }
      // eslint-disable-next-line no-console
      console.log(random, 'add result', result);
      return db.getAll()
        .then((getAllResult: any) => ({ db, result: getAllResult }));
    })
    .then(({ result, db }) => {
      const areEqual = JSON.stringify(result) === JSON.stringify(expectedGetAllResult);
      if (expectedGetAllResult && !areEqual) {
        return Promise.reject(new Error('our test failed'));
      }
      // eslint-disable-next-line no-console
      console.log(random, 'get all result', result);
      return db;
    })
    .then((db) => db.getAll().then(presentWhatsInTheDatabase))
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error(random, 'error occurred in indexedDB', err);
    });
});
