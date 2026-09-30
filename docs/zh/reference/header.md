---
title: Headers
order: 5
---

# {{ $frontmatter.title }}

`OhNetHeader` 是大小写不敏感, 带 RFC 7230 校验的多值 HTTP header 集合. 它的行为类似浏览器 `Headers` 类, 并额外支持多种输入形态.

## OhNetHeader

```ts
class OhNetHeader implements Iterable<[string, string]> {
  constructor(init?: OhNetHeaderLike | null)
  static from(init?: OhNetHeaderLike | null): OhNetHeader

  append(name: string, value: string): this
  set(name: string, value: string): this
  get(name: string): string | null
  has(name: string): boolean
  delete(name: string): boolean
  getSetCookie(): string[]

  forEach(callback: (value: string, key: string, parent: OhNetHeader) => void, thisArg?: unknown): void
  keys(): IterableIterator<string>
  values(): IterableIterator<string>
  entries(): IterableIterator<[string, string]>
  [Symbol.iterator](): IterableIterator<[string, string]>

  clone(): OhNetHeader
  concat(other: OhNetHeaderLike): OhNetHeader
  toRecord(): OhNetHeaderRecord
  toJSON(): OhNetHeaderRecord
}
```

name 会被去除首尾空白, 转为小写, 并按 RFC 7230 token 语法校验. value 拒绝 NUL, CR, LF, 且会被去除首尾空白.

### constructor(init?)

从任意 [`OhNetHeaderLike`](#ohnetheaderlike) 构建集合. 省略 `init` 得到空集合.

### OhNetHeader.from(init?)

构造函数的静态别名.

### append(name, value)

把 `value` 追加到 `name` 下的值列表. 已有值保留. name 或 value 非法时抛 `TypeError`. 返回 `this`.

### set(name, value)

用 `value` 替换 `name` 下的所有值. 返回 `this`.

### get(name)

返回 `name` 下的值以 `", "` 连接后的字符串, 不存在时为 `null`.

### has(name)

返回 `name` 下是否存有值.

### delete(name)

移除 `name` 下的所有值, 并报告此前是否存在.

### getSetCookie()

以数组返回 `set-cookie` 的值. set-cookie 不能被连接, 因此该方法镜像 `Headers.getSetCookie()` 并返回一份拷贝.

### forEach(callback, thisArg?)

每个已存值调用一次 `callback`. 回调收到 `(value, name, parent)`. 多值 header 按值各触发一次, 而不是按 name.

### keys() / values() / entries()

三个迭代器按值对齐, 因此一个有俩值的 header 会让 `keys()` 产出两次同名. `[Symbol.iterator]` 委托给 `entries()`, 于是集合可被 `[...headers]` 展开.

### clone()

返回不与被克隆者共享存储的深拷贝.

### concat(other)

返回一个把 `other` 叠加其上的新集合. 同名时 `other` 的值替换接收者的值; 两侧独有的值都保留. 接收者不被修改.

### toRecord()

返回把所有值以 `", "` 连接后的普通对象. `toJSON` 与之相同, 因此 `JSON.stringify(headers)` 得到该对象形态.

## OhNetHeaderRecord

```ts
type OhNetHeaderRecord = Record<string, string>
```

普通对象形态; 每个 name 映射到单个连接后的字符串.

## OhNetHeaderEntry

```ts
type OhNetHeaderEntry = readonly string[]
```

单个 `[name, value]` pair.

## OhNetHeaderEntries

```ts
type OhNetHeaderEntries = Iterable<OhNetHeaderEntry>
```

pair 的 iterable, 通常是 `Map` 或 generator.

## OhNetHeaderIterable

```ts
interface OhNetHeaderIterable {
  forEach: (callback: (value: string, key: string) => void, thisArg?: unknown) => void
}
```

与浏览器 `Headers` 类兼容的鸭子类型接口.

## OhNetHeaderLike

```ts
type OhNetHeaderLike
  = | OhNetHeader
    | OhNetHeaderRecord
    | OhNetHeaderEntries
    | OhNetHeaderIterable
```

构造函数与 `concat()` 接受的所有输入形态的联合.

## 示例

```ts
const headers = new OhNetHeader()
  .set("content-type", "application/json")
  .append("set-cookie", "a=1")
  .append("set-cookie", "b=2")

headers.get("content-type") // "application/json"
headers.getSetCookie() // ["a=1", "b=2"]
console.log([...headers]) // [["content-type", "application/json"], ["set-cookie", "a=1"], ["set-cookie", "b=2"]]
```

## 下一步

- [适配器与上下文](./transport.md): 请求与响应中使用 `OhNetHeader` 的地方.
- [信号](./signal.md): 另一个小型值类型.
- [错误](./errors.md): header 校验抛出的错误类.
