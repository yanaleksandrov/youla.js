import { directive } from '../directives';

directive('prop', (el, expression, attribute, x, component) => {
  let {modifiers} = attribute;

  if (modifiers.includes('query')) {
    let key = attribute.expression;
    if (key) {
      let query = (component.root.__x_query ??= {});

      if (expression == null || expression === '') {
        delete query[key];
      } else {
        query[key] = typeof expression === 'string' ? expression.replace(/ /g, '+').slice(0, 24) : expression;
      }

      console.log(query)

      updateQueryParams(query);
    }
  }
});

const updateQueryParams = object => {
  const urlParams = new URLSearchParams(window.location.search);

  for (const key in object) {
    let value = object[key];

    // Если value — массив, преобразуем его в строку с разделением запятой
    if (Array.isArray(value)) {
      value = value.join(',');
    }

    // Проверяем, если значение пустое или null, то удаляем параметр
    if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) {
      urlParams.delete(key);
    } else {
      // Кодируем значение, но оставляем запятую без изменений
      urlParams.set(key, encodeURIComponent(value).replace(/%2C/g, ','));
    }
  }

  // Преобразуем строку URL
  history.replaceState({}, '', '?' + urlParams.toString());
};



window.addEventListener('popstate', updateQueryParams);