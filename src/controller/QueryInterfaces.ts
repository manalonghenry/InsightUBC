export interface QueryOptions{
	COLUMNS: string[];
	ORDER?: SortOptions; // For Sections
	// SORT?: SortOptions; // For Rooms
}

// export interface SortOptions{
// 	ORDER: string | Direction;
// }

export type SortOptions = Direction | string;

export interface Direction {
	dir: "UP" | "DOWN";
	keys: string[];
}

export interface QueryTransformations {
	GROUP: string[];
	APPLY: ApplyRule[];
}

// export interface ApplyOptions{
// 	ApplyRuleList: ApplyRule[];
// }

export interface ApplyRule {
	[applykey: string]: {
		[APPLYTOKEN: string]: string; // The APPLYTOKEN can be 'MAX', 'MIN', 'AVG', 'COUNT', or 'SUM'

	};
}

// export interface  ApplyRule {
// 	applykey: string;
// 	applyToken: "MAX" | "MIN" | "AVG" | "COUNT" | "SUM";
// 	key: string; // mkey or an skey
// }

export interface MComparison{
	MComparator: "LT" | "GT" | "EQ";
	mkey: {
		idString: string;
		mfield: string;
	};
	value: number;
}

export interface LogicComparison{
	AND: Filter[];
	OR: Filter[];
	NOT: Filter;
}

export interface SComparison{
	is: "IS";
	skey: {
		idString: string;
		sfield: string;
	}
	InputString: string;
}

export interface Negation{
	NOT: Filter;
}

export interface Query{
	WHERE: Filter;
	OPTIONS: QueryOptions;
	TRANSFORMATIONS?: QueryTransformations;
}

export interface Course {
	[key: string]: string | number;
	uuid: string;
	id: string;
	title: string;
	instructor: string;
	dept: string;
	year: number;
	avg: number;
	pass: number;
	fail: number;
	audit: number;
}

export interface Room {
	[key: string]: string | number;
	fullname: string;
	shortname: string;
	number: string;
	name: string;
	address: string;
	lat: number;
	lon: number;
	seats: number;
	type: string;
	furniture: string;
	href: string;
}

export type Filter = LogicComparison | MComparison | SComparison | Negation;

