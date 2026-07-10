const base = import.meta.env.BASE_URL.replace(/\/$/, "");

export function withBase(path = "/") {
	if (/^(?:[a-z]+:|#)/i.test(path)) return path;
	const normalized = path.startsWith("/") ? path : `/${path}`;
	return `${base}${normalized}` || normalized;
}

export function withoutBase(pathname: string) {
	if (!base || !pathname.startsWith(base)) return pathname;
	return pathname.slice(base.length) || "/";
}
